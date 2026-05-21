// trading-bot-protection.ts
//
// Pattern A: a guarded trade executor. Every transaction the bot wants to
// send is first checked against drain't's classifier. Critical targets
// throw; warnings are logged but proceed (you can tighten this policy).
//
// Designed for AI trading agents that have been delegated execution
// permission on a Smart Account (ERC-7710 / EIP-7715 flows).

const DRAINT_API_BASE =
  process.env.DRAINT_API_BASE ?? "https://draint-be.vercel.app";

export interface DraintVerdict {
  chainId: number;
  target: `0x${string}`;
  riskScore: number;
  severity: "safe" | "unknown" | "warning" | "critical";
  matchedPattern: string | null;
  reasons: string[];
}

export interface BotTx {
  chainId: number;
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
}

export class DraintBlockedError extends Error {
  constructor(
    public readonly verdict: DraintVerdict,
    public readonly tx: BotTx,
  ) {
    super(
      `drain't blocked tx to ${verdict.target} — ${verdict.matchedPattern ?? "high risk"}`,
    );
  }
}

async function classify(
  chainId: number,
  target: `0x${string}`,
): Promise<DraintVerdict> {
  const res = await fetch(`${DRAINT_API_BASE}/api/classify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId, target }),
  });
  if (!res.ok) {
    throw new Error(`drain't HTTP ${res.status}`);
  }
  return (await res.json()) as DraintVerdict;
}

/**
 * Wrap your bot's tx sender. Throws DraintBlockedError on critical risk.
 * Logs a warning on borderline cases but allows the tx through.
 */
export async function guardedSend(
  tx: BotTx,
  send: (tx: BotTx) => Promise<`0x${string}`>,
): Promise<`0x${string}`> {
  let verdict: DraintVerdict;
  try {
    verdict = await classify(tx.chainId, tx.to);
  } catch (err) {
    // Fail open by default — drain't outage shouldn't halt the bot.
    // Change to `throw err` if you prefer fail-closed.
    console.error("drain't classify failed, proceeding:", err);
    return send(tx);
  }

  if (verdict.severity === "critical") {
    throw new DraintBlockedError(verdict, tx);
  }
  if (verdict.severity === "warning") {
    console.warn(
      `drain't WARN (${verdict.matchedPattern}) ->`,
      verdict.reasons.join(" | "),
    );
  }
  return send(tx);
}

// ─── Example wiring ────────────────────────────────────────────────

declare const walletClient: {
  sendTransaction(tx: BotTx): Promise<`0x${string}`>;
};

export async function exampleTrade() {
  const swapTx: BotTx = {
    chainId: 1,
    to: "0xa3b...c92" as `0x${string}`, // some router
    data: "0x..." as `0x${string}`,
  };

  try {
    const hash = await guardedSend(swapTx, (t) =>
      walletClient.sendTransaction(t),
    );
    console.log("trade sent:", hash);
  } catch (err) {
    if (err instanceof DraintBlockedError) {
      // Move to dead-letter queue, alert operator, etc.
      console.error("BLOCKED:", err.verdict.reasons);
    } else {
      throw err;
    }
  }
}
