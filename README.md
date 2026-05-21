# draint-skills

> **Build-time Agent Skills for [drain't](https://github.com/DraintAi)** — install into your AI coding environment (Claude Code, Cursor, Codex) for production integration guidance.
>
> _Wallet drain? Didn't happen._

drain't is an AI security agent + composable skill that defends Ethereum wallets against **EIP-7702 delegation drainer attacks** (CrimeEnjoyor family) and **Permit / Permit2 phishing**.

## Install

```bash
# Universal — any skill-aware AI coding env
npx skills add DraintAi/draint-skills/security
```

After install, your coding agent will have full context on:

- drain't SDK methods, types, and error shapes
- The threat model (EIP-7702 delegation drainer mechanics, CrimeEnjoyor signature)
- Integration patterns for trading bots, DeFi agents, MetaMask Snaps
- Decision flow for severity-based response
- Composition with 1Shot Permissionless Relayer for gasless rescue

## What's in the box

```
draint-skills/
├── skills/
│   └── security/
│       ├── SKILL.md                         # full skill spec
│       ├── api-reference.md                 # endpoint + SDK reference
│       └── examples/
│           ├── trading-bot-protection.ts    # Pattern A: pre-sign guard
│           ├── defi-agent-integration.ts    # Pattern B: subscribe + alert
│           └── snap-integration.ts          # Pattern C: MetaMask Snap
├── template/                                 # scaffold for future skills
└── skills.json                               # manifest
```

## Two ways to consume drain't

1. **Build-time skill** (this repo) — your AI coding agent loads the docs and writes correct integration code on day one.
2. **Runtime SDK** — `bun add @draint/sdk` (publishes Day 14 of the hackathon). Your code calls drain't at execution time.

Both layers share the same backend: https://draint-be.vercel.app.

## Quick start (runtime)

```ts
// Until @draint/sdk ships, call REST directly
const res = await fetch("https://draint-be.vercel.app/api/classify", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ chainId: 1, target: "0x..." }),
});
const verdict = await res.json();

if (verdict.severity === "critical") {
  // Block the user from signing / abort tx
}
```

See [`skills/security/SKILL.md`](./skills/security/SKILL.md) for the full guide.

## Convention

This repo follows the same skill-as-docs pattern as:

- **[veniceai/skills](https://github.com/veniceai/skills)** — Venice AI's coding-env skill pack
- **[1Shot-API/skills](https://1shotapi.com/docs)** — 1Shot Permissionless Relayer skill

Install all three, and you have a complete agentic-Web3 stack in your coding env: drain't (security) + Venice (intelligence) + 1Shot (execution).

## Contributing

Add new skills under `skills/<name>/`. Each must have a `SKILL.md` with frontmatter (`name`, `version`, `description`, `keywords`). Update `skills.json` to register.

## License

MIT — see [LICENSE](./LICENSE).

Built for the **MetaMask Smart Accounts Kit x 1Shot API Hackathon**, 2026. See the [project plan](https://github.com/DraintAi) for full context.
