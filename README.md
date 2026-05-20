# draint-skills

> **Build-time Agent Skills for [drain't](https://github.com/DraintAi)** — install into your AI coding environment (Claude Code, Cursor, Codex) to get integration guidance for the drain't security API.

One folder per surface area, each with a `SKILL.md` for agent runtimes.

## What is this?

drain't is an AI security agent that protects wallets from EIP-7702 delegation drainer attacks. While building your own AI agent (trading bot, DeFi assistant, AA wallet, etc.), you can integrate drain't via:

- **Runtime SDK** — `npm install @draint/sdk` — your agent calls drain't at runtime
- **Build-time skill (this repo)** — install into your coding env, get best-practice guidance + code samples while you build

Modeled after [`veniceai/skills`](https://github.com/veniceai/skills) and [1Shot API skills](https://1shotapi.com/docs/quickstarts/gas-sponsorship-eip7710) conventions.

## Install

### Claude Code / Cursor / Codex (universal)

```bash
npx skills add DraintAi/draint-skills/security
```

After install, your coding agent has access to:
- Integration patterns for `@draint/sdk`
- EIP-7702 delegation safety checklist
- Sample code: trading bot guard, DeFi agent protection, MetaMask Snap pattern
- Common gotchas + debugging tips

## Available skills

| Skill | Purpose |
|---|---|
| `security` | Pre-sign classification, delegation safety, rescue patterns |

(More surfaces will land Day 12+ during hackathon build.)

## Manifest

See `skills.json` for the canonical skill index.

## License

MIT — see [LICENSE](./LICENSE).

---

Part of the **MetaMask Smart Accounts Kit x 1Shot API Hackathon** submission. See [PLAN.md](https://github.com/DraintAi) for full project context.
