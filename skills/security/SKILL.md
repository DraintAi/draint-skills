---
name: drain't security
version: 0.1.0
description: Integration guide for @draint/sdk — pre-sign classification, EIP-7702 delegation safety, autonomous monitoring, and gasless rescue patterns
keywords: [eip-7702, drainer, wallet-security, metamask-snap, agent-skill, crimeenjoyor]
---

# drain't · Security Skill

> **Wallet drain? Didn't happen.**
>
> drain't is an AI security agent + composable skill that defends Ethereum wallets against EIP-7702 delegation drainer attacks (CrimeEnjoyor family) and Permit/Permit2 phishing. Install this skill into your AI coding environment (Claude Code, Cursor, Codex) to get production-grade integration guidance.

## Quick start

```bash
# In any AI coding env that supports skills
npx skills add DraintAi/draint-skills/security

# Runtime SDK (in your agent / app code)
bun add @draint/sdk
# or npm install @draint/sdk
```

```ts
import { Sentinel } from "@draint/sdk";

const draint = new Sentinel({ apiKey: process.env.DRAINT_API_KEY });
const verdict = await draint.classifyContract({ chainId: 1, target: "0x..." });

if (verdict.severity === "critical") {
  // Refuse to sign / abort the tx
}
```

## When to use this skill

Use drain't whenever your code or your agent handles **signatures, delegations, or autonomous on-chain execution**. Concretely:

- AI trading agents (DeFi bots, MEV searchers, yield routers)
- Account-abstraction wallets and Smart-EOA upgrades
- MetaMask Snaps that intercept signatures or transactions
- AA wallet UX flows that prompt 7702 authorizations
- Any product that lets an EOA upgrade itself via Pectra-era EIP-7702

Skip it if your code only handles read-only on-chain data with no signing surface.

## Why drain't exists

After the Pectra upgrade (May 2025), Ethereum mainnet added EIP-7702 — any EOA can delegate its execution to a smart contract by signing a single authorization. Attackers exploited this immediately:

- **~97%** of EIP-7702 delegations on mainnet point at malicious sweeper contracts (Wintermute on-chain analysis)
- The **CrimeEnjoyor** family (canonical name from Wintermute research) is the most common drainer: 23–500 byte contracts with fallback-only dispatch that auto-forward incoming assets to a hardcoded attacker address
- **450,000+ wallets** drained in the first six months post-Pectra
- Variants: `CrimeEnjoyor`, `CrimeEnjoyor2`, `AdvancedCrimeEnjoyor`, `HardcodedCrimeEnjoyor`

drain't gives your code the same threat-detection brain that the drain't reference agent uses to monitor wallets autonomously.

## Architecture

drain't is two layers, one backend:

```
                    ┌──────────────────────────────┐
                    │  draint-be (Vercel)          │
                    │                              │
                    │  Heuristic classifier        │
                    │  + Venice AI (GLM-5.1)       │
                    │  + Etherscan + viem          │
                    └────┬────────────────────┬────┘
                         │                    │
       Runtime users     │                    │  Build-time users
       ─────────────     │                    │  ──────────────
       AI agents         │                    │  Developers
       MetaMask Snaps    │                    │  AI coding agents
       Webhooks          │                    │
            ▼                                 ▼
       @draint/sdk                       @draint/skill (this)
       (runtime calls)                   (you are here)
```

Both layers consume the same backend. This skill teaches the runtime SDK and Snap-side integration.

## Integration patterns

### Pattern A — Pre-sign guard for an AI agent

The default pattern for any agent that sends transactions. Call drain't **before** signing, abort if critical.

```ts
import { Sentinel } from "@draint/sdk";
import { sendTransaction } from "viem/actions";

const draint = new Sentinel({ apiKey: process.env.DRAINT_API_KEY! });

async function guardedSend(walletClient, tx) {
  // Inspect the call target before signing
  if (tx.to) {
    const verdict = await draint.classifyContract({
      chainId: walletClient.chain.id,
      target: tx.to,
    });

    if (verdict.severity === "critical") {
      console.error(`drain't blocked: ${verdict.matchedPattern}`);
      throw new Error("Transaction blocked by drain't");
    }

    if (verdict.severity === "warning") {
      // Decide policy: log, prompt user, etc.
      console.warn("drain't warning:", verdict.reasons);
    }
  }

  return sendTransaction(walletClient, tx);
}
```

See `examples/trading-bot-protection.ts` for a full implementation.

### Pattern B — Autonomous monitor for delegated wallets

If your agent has been delegated emergency permissions (via ERC-7710), it can monitor delegations on the wallet's behalf and rescue.

```ts
import { Sentinel } from "@draint/sdk";

const draint = new Sentinel({ apiKey: process.env.DRAINT_API_KEY! });

// Tell drain't to watch this wallet
await draint.subscribe({
  chainId: 1,
  address: userWalletAddress,
  recoveryAddress: safeWalletAddress,
  autoRescue: true,
});

// drain't will call your webhook on incidents
// POST https://your-agent.example.com/draint/incident
// Body: { kind, severity, target, ... }
```

See `examples/defi-agent-integration.ts` for the full webhook handler.

### Pattern C — MetaMask Snap signature insight

Wrap drain't's classifier inside an MM Snap to warn users before they sign.

```ts
import type { OnSignatureHandler } from "@metamask/snaps-sdk";

export const onSignature: OnSignatureHandler = async ({ signature }) => {
  // Extract Permit spender or 7702 target (depends on signature method)
  const target = extractTarget(signature);
  if (!target) return null;

  const res = await fetch("https://draint-be.vercel.app/api/classify", {
    method: "POST",
    body: JSON.stringify({ chainId: signature.chainId, target }),
  }).then((r) => r.json());

  if (res.severity === "safe") return null;

  return {
    severity: res.severity === "critical" ? "critical" : "warning",
    content: /* render warning panel */,
  };
};
```

See `examples/snap-integration.ts`. The drain't reference Snap is at https://github.com/DraintAi/draint-fe/tree/main/snap.

### Pattern D — Composing with 1Shot relayer

For the agentic-rescue use case (Day 11 in the project plan), pair drain't with 1Shot Permissionless Relayer:

```ts
import { Sentinel } from "@draint/sdk";
import { OneShotRelayer } from "@1shot/skill"; // hypothetical pkg name

const draint = new Sentinel({ apiKey: process.env.DRAINT_API_KEY! });
const relayer = new OneShotRelayer({ apiKey: process.env.ONESHOT_API_KEY! });

draint.on("incident", async (incident) => {
  if (incident.severity !== "critical" || !incident.autoRescue) return;

  // Build a 7702 revocation authorization
  const revokeAuth = await signRevocation(incident.address);

  // Broadcast gasless via 1Shot — gas paid in stablecoin
  const result = await relayer.send7710Transaction({
    authorizationList: [revokeAuth],
    paymentToken: "USDC",
  });

  console.log("rescue tx:", result.txHash);
});
```

This is the agent-to-agent coordination pattern that powers the Best A2A track for the MetaMask hackathon.

## Decision flow

```
                  signature / tx arrives
                          │
                          ▼
                  is target an EVM address?
                  ┌───────┴───────┐
                  │ no            │ yes
                  ▼               ▼
                ignore     draint.classifyContract()
                                  │
                                  ▼
                            risk score 0..1
                  ┌───────────────┼───────────────┐
                  │               │               │
              < 0.3            0.3-0.7          >= 0.7
                  │               │               │
                  ▼               ▼               ▼
              proceed        warn user       block + alert
                            (Pattern A/C)   (Pattern A/C/D)
                            heuristic +
                            Venice AI
```

## CrimeEnjoyor signature (for context)

drain't's heuristic flags contracts that match this shape:

| Property | Value | Why |
|---|---|---|
| Runtime bytecode size | < 600 bytes | Real sweepers are tiny |
| Public function selectors | ≤ 3 | Drainers expose almost nothing |
| Fallback function | present | Auto-drain on any incoming call |
| Verified source | typically no | Drainers usually unverified |
| Contract age | often < 24h | Spun up per attack campaign |
| Bytecode hash | known list | Wintermute-published variants |

When 4+ of these align, severity is at least `warning`. Bytecode hash exact match → `critical` (risk 1.0).

## Gotchas

1. **EIP-7702 auth signing happens off-protocol.** MetaMask's `onSignature` Snap handler does not receive 7702 authorizations. Use `onTransaction` for type-0x04 txs, or wrap the dApp's `walletClient.signAuthorization()` call directly.
2. **The classifier needs a live RPC.** Default is `ethereum-rpc.publicnode.com`. Set `ETHEREUM_MAINNET_RPC_URL` / `ETHEREUM_SEPOLIA_RPC_URL` env vars for your own keys.
3. **Venice AI is optional.** If `VENICE_API_KEY` is unset, drain't falls back to heuristic only. Borderline cases (risk 0.3-0.7) won't get the LLM uplift — accuracy is still good, just less explainability.
4. **Mainnet rescue requires 1Shot mainnet relayer + a USDC budget.** Sepolia testing is free; production rescue costs ~$0.50/tx in gas paid via stablecoin (1Shot pricing).
5. **EOAs vs smart EOAs vs contracts.** drain't disambiguates correctly: plain EOA = safe-by-design, smart EOA = surface the delegation target for separate classify, contract = run full pipeline.
6. **False positives on tiny legit contracts.** Some proxy/forwarder contracts (especially older multisigs) match the size + low-selectors heuristic. Always read the `reasons` field, don't blindly block.

## API reference

See [`api-reference.md`](./api-reference.md) for the full method surface.

## Examples

- [`examples/trading-bot-protection.ts`](./examples/trading-bot-protection.ts) — Pattern A, pre-sign guard
- [`examples/defi-agent-integration.ts`](./examples/defi-agent-integration.ts) — Pattern B, subscribe + webhook
- [`examples/snap-integration.ts`](./examples/snap-integration.ts) — Pattern C, MM Snap wiring

## References

- drain't backend repo: https://github.com/DraintAi/draint-be
- drain't dashboard: https://draint.vercel.app (deploys from `draint-fe`)
- EIP-7702 spec: https://eips.ethereum.org/EIPS/eip-7702
- Wintermute CrimeEnjoyor research: https://x.com/wintermute_t/status/1932101433916305743
- MetaMask Smart Accounts Kit: https://docs.metamask.io/smart-accounts-kit/
- 1Shot Permissionless Relayer: https://1shotapi.com/docs/quickstarts/gas-sponsorship-eip7710
- Venice AI: https://docs.venice.ai

## License

MIT. Part of [DraintAi/draint](https://github.com/DraintAi), built for the **MetaMask Smart Accounts Kit x 1Shot API Hackathon**, 2026.
