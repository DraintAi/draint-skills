# drain't · API Reference

Live API base: `https://draint-be.vercel.app`. SDK wraps these endpoints.

> ℹ️ SDK is published to npm at **Day 14** of the hackathon. Until then, call the REST endpoints directly with `fetch`.

## Base concepts

### `Severity`

```ts
type Severity = "safe" | "unknown" | "warning" | "critical";
```

- `safe`: heuristic score < 0.3. No action needed.
- `unknown`: 0.3-0.5. Inconclusive — surface to user, do not block.
- `warning`: 0.5-0.7. Likely drainer-class. Default policy: prompt for confirmation.
- `critical`: ≥ 0.7. CrimeEnjoyor signature match or exact bytecode hit. Block by default.

### `ClassifyResult`

```ts
interface ClassifyResult {
  chainId: number;
  target: `0x${string}`;
  riskScore: number;          // 0.0 - 1.0 (final, post-merge)
  severity: Severity;
  matchedPattern: string | null;
  reasons: string[];
  features: ContractFeatures;
  heuristic: { riskScore: number; severity: Severity };
  venice: VeniceVerdict | null;  // null if disabled or out-of-band
  classifiedAt: string;       // ISO 8601
  classifierVersion: string;
}
```

## Endpoints

### `POST /api/classify`

Classify a single contract / EOA for delegation-drainer risk.

**Body**

```json
{
  "chainId": 1,
  "target": "0xa3b...c92",
  "origin": "https://maybe-phishing.xyz"   // optional, used for logging
}
```

**Response**: `ClassifyResult` (see above).

**Errors**

- `400` — invalid input. `details.fieldErrors` enumerates which field failed.
- `500` — classifier downstream failure (RPC unreachable, etc.). Body includes `message`.

**Example**

```bash
curl -sX POST https://draint-be.vercel.app/api/classify \
  -H 'content-type: application/json' \
  -d '{"chainId":1,"target":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"}'
```

### `GET /api/classify/:chainId/:address`

Same as POST, just URL-friendly. Use this for browser tests and curl one-liners.

```bash
curl -s https://draint-be.vercel.app/api/classify/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
```

### Agent endpoints (autonomous monitor)

#### `POST /api/agent/watch`

Add an address to the monitored set. drain't will probe its bytecode every minute (Vercel Cron) and raise an incident if a 7702 delegation appears.

```json
{
  "address": "0x...",
  "chainId": 1,
  "recoveryAddress": "0x...",   // optional, used by autoRescue
  "autoRescue": false           // default false; if true, critical incidents queue 1Shot rescue (Day 11)
}
```

#### `GET /api/agent/watch`

List all watched addresses.

#### `DELETE /api/agent/watch/:chainId/:address`

Remove a watch.

#### `GET /api/agent/tick`

Manually invoke one monitoring cycle. Also called by Vercel Cron once per minute. Returns:

```json
{
  "startedAt": "2026-05-21T14:12:15.035Z",
  "finishedAt": "2026-05-21T14:12:18.215Z",
  "durationMs": 3180,
  "watchedCount": 1,
  "changesDetected": 1,
  "incidentsRaised": 0,
  "errors": []
}
```

If you set `CRON_SECRET` env var on the deployment, requests must carry `Authorization: Bearer <secret>`.

#### `GET /api/agent/incidents?limit=20`

Read the alert log (last `limit` incidents, newest first).

```json
{
  "incidents": [
    {
      "id": "inc_...",
      "at": "2026-05-21T14:12:18.000Z",
      "kind": "delegation_critical",
      "address": "0x...",
      "chainId": 1,
      "delegationTarget": "0x...",
      "severity": "critical",
      "riskScore": 1.0,
      "matchedPattern": "crime_enjoyor_signature",
      "reasoning": ["..."],
      "rescue": null
    }
  ]
}
```

#### `POST /api/agent/clear`

Wipe watch + incidents. Demo / dev use only.

### `GET /api/health`

Liveness check.

### `GET /`

Service metadata (version, classifier version, Venice status, endpoint list).

## SDK (planned, ships Day 14)

```ts
import { Sentinel } from "@draint/sdk";

const draint = new Sentinel({
  apiKey: process.env.DRAINT_API_KEY,
  baseUrl: "https://draint-be.vercel.app",  // defaults to this
});

await draint.classifyContract({ chainId, target });
await draint.simulateTransaction(tx);        // wraps /api/classify with the tx.to
await draint.subscribe({ address, chainId, recoveryAddress, autoRescue });
await draint.unsubscribe({ address, chainId });
await draint.getIncidents({ limit });
draint.on("incident", (incident) => { /* webhook-style local handler */ });
```

Until the SDK ships, call the REST endpoints directly.

## Rate limits

drain't backend currently has no rate limits in the hackathon build. After Day 14 we plan to introduce a soft limit (~60 req/min/IP) once the public deployment is stable.

## Privacy

drain't sends classification queries to its backend, which may call:

- An EVM RPC (`publicnode` by default, or your configured key)
- Etherscan (only the target address + chainId)
- Venice AI (only the bytecode features + heuristic prior — never user wallet info)

**No user wallet address is logged or sent to third parties.** Only the classification target is transmitted.

## Bug reports

File issues at https://github.com/DraintAi/draint-be/issues.
