// trading-bot-protection.ts
//
// Pattern A: protect a trading bot from malicious dApp signatures.
// Bot consults drain't before signing any tx; aborts on critical risk.
//
// This is a PLACEHOLDER scaffold — full implementation lands Day 12.

import { Sentinel } from "@draint/sdk";
import type { TransactionRequest } from "viem";

const draint = new Sentinel({
  apiKey: process.env.DRAINT_API_KEY!,
  baseUrl: "https://draint-be.vercel.app",
});

export async function safeTrade(
  tx: TransactionRequest,
  sendFn: (tx: TransactionRequest) => Promise<string>,
) {
  const verdict = await draint.simulateTransaction({
    chainId: tx.chainId ?? 1,
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: tx.value?.toString() ?? "0",
  });

  if (verdict.severity === "critical") {
    throw new Error(
      `drain't blocked tx: ${verdict.reasoning} (risk ${verdict.riskScore})`,
    );
  }

  if (verdict.severity === "warning") {
    console.warn(`drain't WARN: ${verdict.reasoning}`);
    // Decide policy: proceed with caution, or abort?
  }

  return await sendFn(tx);
}
