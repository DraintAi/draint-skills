---
name: drain't security
version: 0.1.0
description: Integration guidance for @draint/sdk — pre-sign classification, EIP-7702 delegation safety, and gasless rescue patterns
keywords: [eip-7702, drainer, wallet-security, metamask-snap, agent-skill]
---

# drain't · Security Skill

> **Purpose**: when you (or your AI coding agent) are building a Web3 product that touches signatures, delegations, or autonomous tx execution, this skill teaches you how to integrate drain't to defend against EIP-7702 delegation drainer attacks.

## When to use this skill

Trigger this skill while building:
- Trading bots that sign tx programmatically
- DeFi agents with delegated permissions
- AA wallets / smart account UX
- MetaMask Snaps that intercept signatures
- Any AI agent that has on-chain capabilities

## Core concepts

### EIP-7702 delegation drainer (the threat)

After the Ethereum Pectra upgrade (May 2025), an EOA can delegate execution to a smart contract by signing a single authorization. **97% of EIP-7702 delegations in the wild point to malicious "CrimeEnjoyor"-class drainer contracts** that auto-forward incoming assets on the same block they arrive.

If your agent / app prompts a user to sign a 7702 authorization without classifying the target — or if your agent itself can be tricked into signing one — funds drain instantly.

### How drain't protects

drain't exposes a classifier API + runtime SDK:

- **Pre-sign**: `sentinel.classifyContract(address)` returns risk score before the user signs
- **Post-sign monitor**: subscribe to wallet → autonomous rescue via 1Shot if a malicious delegation appears
- **Reasoning**: Venice AI generates human-readable explanations

## Integration patterns

### Pattern A — Trading bot guard

```ts
import { Sentinel } from "@draint/sdk";

const draint = new Sentinel({ apiKey: process.env.DRAINT_API_KEY });

async function executeTrade(tx) {
  const verdict = await draint.simulateTransaction(tx);

  if (verdict.severity === "critical") {
    console.log(`drain't BLOCKED: ${verdict.reasoning}`);
    return abortTrade();
  }

  return await wallet.sendTransaction(tx);
}
```

### Pattern B — DeFi agent with delegated permission

```ts
import { Sentinel } from "@draint/sdk";

const draint = new Sentinel({ apiKey: process.env.DRAINT_API_KEY });

// Subscribe wallet to monitor — drain't will auto-rescue malicious delegations
await draint.subscribeMonitor(wallet.address, {
  onThreatDetected: async (alert) => {
    console.log("Threat:", alert.reasoning);
    // Optional: pause agent operations
    await pauseAgent();
  },
});
```

### Pattern C — MetaMask Snap

If you're building a Snap, use drain't's classifier inside `onSignature`:

```ts
import type { OnSignatureHandler } from "@metamask/snaps-sdk";

export const onSignature: OnSignatureHandler = async ({ signature }) => {
  if (!is7702Authorization(signature)) return null;

  const target = extract7702Target(signature);
  const verdict = await fetch("https://draint-be.vercel.app/api/classify", {
    method: "POST",
    body: JSON.stringify({ chainId: signature.chainId, target }),
  }).then((r) => r.json());

  if (verdict.riskScore < 0.3) return null;

  return {
    severity: verdict.riskScore >= 0.7 ? "critical" : "warning",
    content: /* render warning UI */,
  };
};
```

## Gotchas

1. **EOA private key still signs the 7702 auth** — drain't can warn pre-sign, but if the user signs anyway, post-sign rescue depends on race conditions. Use defense in depth.
2. **Mainnet only for 1Shot rescue** — drain't's gasless rescue path requires Ethereum mainnet via 1Shot Permissionless Relayer.
3. **Classifier latency** — 50-500ms typical (cache hit), up to 2s (cold + Venice AI call). Don't block UX critical path on it; use it as gate, not as inline render.
4. **False positives** — classifier targets <5%, but for new/unverified contracts you may see warnings. Allowlist trusted contracts in your app.

## Example projects in repo

See `examples/`:
- `trading-bot-protection.ts` — Pattern A full implementation
- `defi-agent-integration.ts` — Pattern B with subscribe + auto-pause

## References

- [drain't backend repo](https://github.com/DraintAi/draint-be)
- [drain't SDK source](https://github.com/DraintAi/draint-be/tree/main/packages/sdk)
- [drain't dashboard](https://draint.vercel.app)
- [EIP-7702 spec](https://eips.ethereum.org/EIPS/eip-7702)
- [CrimeEnjoyor research (Wintermute)](https://dev.to/ohmygod/the-crimeenjoyor-epidemic-how-eip-7702-delegation-phishing-drained-450k-wallets-and-how-to-e2g)

## Roadmap

This skill is a starting scaffold. Expanding through hackathon Day 12+:
- [ ] Complete `examples/` with runnable demos
- [ ] Add `cross-chain.md` sub-skill for multi-chain monitoring
- [ ] Add `rescue-patterns.md` for advanced 1Shot relayer composition

---

Built for **MetaMask Smart Accounts Kit x 1Shot API Hackathon**, 2026.
