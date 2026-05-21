// snap-integration.ts
//
// Pattern C: integrate drain't's classifier into a MetaMask Snap.
// Two intercept points cover most drainer surfaces:
//
//   1. onSignature   — Permit / Permit2 phishing (EIP-712 typed data with
//                      a "spender" field). MetaMask exposes this signature
//                      to the Snap before the user confirms.
//   2. onTransaction — EIP-7702 SET_CODE (tx type 0x04) with an
//                      authorizationList. Each entry delegates the EOA's
//                      code to one contract; classify each target.
//
// Note: MM's onSignature does NOT currently receive 7702 authorization
// signatures (they're produced by viem `signAuthorization` direct, not as
// a JSON-RPC method). The 7702 catch happens at onTransaction instead.

import type {
  OnSignatureHandler,
  OnTransactionHandler,
} from "@metamask/snaps-sdk";

const DRAINT_API_BASE = "https://draint-be.vercel.app";

interface ClassifyResult {
  chainId: number;
  target: `0x${string}`;
  riskScore: number;
  severity: "safe" | "unknown" | "warning" | "critical";
  matchedPattern: string | null;
  reasons: string[];
}

async function classify(
  chainId: number,
  target: `0x${string}`,
): Promise<ClassifyResult | null> {
  try {
    const res = await fetch(`${DRAINT_API_BASE}/api/classify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chainId, target }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ClassifyResult;
  } catch {
    return null;
  }
}

// ─── onSignature: Permit / Permit2 phishing ───────────────────────

export const onSignature: OnSignatureHandler = async ({
  signature,
  signatureOrigin,
}) => {
  if (
    signature.signatureMethod !== "eth_signTypedData_v4" &&
    signature.signatureMethod !== "eth_signTypedData_v3"
  ) {
    return null;
  }

  const data = signature.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const primaryType = data.primaryType as string;
  const message = data.message as Record<string, unknown> | undefined;
  const domain = data.domain as Record<string, unknown> | undefined;

  if (!message) return null;

  // Permit / Permit2 share a `spender` field. Extract it.
  let target: string | undefined;
  if (primaryType === "Permit" || primaryType?.startsWith("Permit")) {
    target = (message.spender as string) ?? undefined;
  }
  if (!target || !/^0x[a-fA-F0-9]{40}$/.test(target)) return null;

  const chainId = domain?.chainId ? Number(domain.chainId) : 1;
  const verdict = await classify(chainId, target as `0x${string}`);
  if (!verdict || verdict.severity === "safe" || verdict.severity === "unknown") {
    return null;
  }

  return {
    severity: verdict.severity === "critical" ? "critical" : "warning",
    // In real code render a JSX panel with Banner/Section. Plain text here
    // for skill-example simplicity.
    content: {
      value: `drain't flagged this Permit as ${verdict.severity.toUpperCase()}.
Spender: ${target}
Reasons:
${verdict.reasons.slice(0, 3).map((r) => `- ${r}`).join("\n")}
Origin: ${signatureOrigin}`,
      markdown: false,
    },
  };
};

// ─── onTransaction: EIP-7702 SET_CODE ─────────────────────────────

export const onTransaction: OnTransactionHandler = async ({
  transaction,
  chainId,
}) => {
  const tx = transaction as unknown as Record<string, unknown>;
  const type = tx.type;
  const isType4 =
    type === "0x04" || type === "0x4" || type === 4 || type === "4";

  const authList =
    (tx.authorizationList as unknown[]) ??
    (tx.authorization_list as unknown[]) ??
    (tx.authorizations as unknown[]);

  if ((!isType4 && !authList) || !Array.isArray(authList)) return null;

  // Extract delegation targets
  const targets: `0x${string}`[] = [];
  for (const a of authList) {
    if (!a || typeof a !== "object") continue;
    const obj = a as Record<string, unknown>;
    const addr = obj.address ?? obj.contractAddress ?? obj.delegateAddress;
    if (typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
      targets.push(addr.toLowerCase() as `0x${string}`);
    }
  }
  if (targets.length === 0) return null;

  // Parse chainId (CAIP-2 "eip155:1" or hex)
  const numericChainId = chainId.startsWith("eip155:")
    ? Number(chainId.slice(7))
    : chainId.startsWith("0x")
      ? parseInt(chainId, 16)
      : Number(chainId) || 1;

  // Classify each, pick worst
  const verdicts = await Promise.all(
    targets.map((t) => classify(numericChainId, t)),
  );
  const worst = verdicts
    .filter((v): v is ClassifyResult => v !== null)
    .sort((a, b) => b.riskScore - a.riskScore)[0];

  if (!worst || worst.severity === "safe" || worst.severity === "unknown") {
    return null;
  }

  return {
    severity: worst.severity === "critical" ? "critical" : "warning",
    content: {
      value: `drain't BLOCKED an EIP-7702 delegation drainer.
Target: ${worst.target}
Pattern: ${worst.matchedPattern}
Risk: ${(worst.riskScore * 100).toFixed(0)}%

${worst.reasons.slice(0, 3).map((r) => `- ${r}`).join("\n")}`,
      markdown: false,
    },
  };
};
