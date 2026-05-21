// defi-agent-integration.ts
//
// Pattern B: subscribe a wallet to drain't's autonomous monitor.
// drain't watches the wallet's bytecode, classifies any new 7702 delegation
// target, and raises an incident. Your DeFi agent gets notified via webhook
// (production) or polls /api/agent/incidents (MVP).
//
// Suitable for agents that have been delegated emergency permissions on the
// user's smart account (ERC-7710 redelegation flow).

const DRAINT_API_BASE =
  process.env.DRAINT_API_BASE ?? "https://draint-be.vercel.app";
const DRAINT_API_KEY = process.env.DRAINT_API_KEY ?? "";

// ─── Subscribe ────────────────────────────────────────────────────

export async function watchWallet(opts: {
  chainId: number;
  address: `0x${string}`;
  recoveryAddress: `0x${string}`;
  autoRescue?: boolean;
}) {
  const res = await fetch(`${DRAINT_API_BASE}/api/agent/watch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(DRAINT_API_KEY ? { authorization: `Bearer ${DRAINT_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      chainId: opts.chainId,
      address: opts.address,
      recoveryAddress: opts.recoveryAddress,
      autoRescue: opts.autoRescue ?? false,
    }),
  });

  if (!res.ok) {
    throw new Error(`drain't subscribe failed: HTTP ${res.status}`);
  }
}

// ─── Poll incidents (MVP path until webhooks ship) ─────────────────

export interface Incident {
  id: string;
  at: string;
  kind: "delegation_changed" | "delegation_malicious" | "delegation_critical";
  address: `0x${string}`;
  chainId: number;
  delegationTarget: `0x${string}` | null;
  severity: "safe" | "unknown" | "warning" | "critical";
  riskScore: number;
  matchedPattern: string | null;
  reasoning: string[];
}

export async function pollIncidents(limit = 20): Promise<Incident[]> {
  const res = await fetch(
    `${DRAINT_API_BASE}/api/agent/incidents?limit=${limit}`,
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { incidents: Incident[] };
  return json.incidents;
}

// ─── Example: a DeFi agent that pauses trading on critical incidents ──

let lastSeenIncidentId: string | null = null;

export async function defiAgentMainLoop() {
  // ... your normal trading logic here ...

  // Every 30s, check drain't for new incidents
  const incidents = await pollIncidents(10);

  for (const incident of incidents) {
    if (incident.id === lastSeenIncidentId) break;

    console.log(`drain't incident: ${incident.kind}`, incident.reasoning);

    if (incident.severity === "critical") {
      // Pause all open positions, log alarm
      await pauseAllOperations(incident);
    } else if (incident.severity === "warning") {
      // Lower risk: alert only, keep trading conservatively
      await alertOps(incident);
    }
  }

  if (incidents.length > 0) lastSeenIncidentId = incidents[0].id;
}

async function pauseAllOperations(incident: Incident) {
  // Implementation up to you — close positions, refuse new trades, etc.
  console.error("PAUSED:", incident.address, "->", incident.delegationTarget);
}

async function alertOps(incident: Incident) {
  // Send to Slack / PagerDuty / etc.
  console.warn("WARN:", incident.address, incident.reasoning.join(" | "));
}
