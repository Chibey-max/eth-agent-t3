/**
 * Script 4 — End-to-end agent invocation demo
 * Demonstrates: TEE policy check → balance query → transfer → queue action
 * Run: ts-node scripts/4-invoke-agent.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { createAgentSession, checkPolicy, getBalance, executeTransfer, queueAction } from "../packages/eth-agent-kit/src/t3/invoke";

async function main() {
  console.log("=== Step 4: End-to-end agent invocation ===\n");

  let contractConfig: { contractId: number; scriptName: string; tenantDid: string };
  try {
    contractConfig = JSON.parse(readFileSync(".contract-config.json", "utf-8"));
  } catch {
    throw new Error("Run scripts 1-3 first");
  }

  // Create agent session (agent authenticates as itself, not as tenant)
  const session = await createAgentSession(contractConfig.tenantDid);

  // ── 1. Policy check ─────────────────────────────────────────────────────
  console.log("\n── 1. Policy check ──");
  const policy = await checkPolicy(session, session.agentDid, "transfer", "500000000000000");
  console.log(`  allowed : ${policy.allowed}`);
  console.log(`  reason  : ${policy.reason}`);

  if (!policy.allowed) {
    console.log("\n⚠ Agent not whitelisted yet.");
    console.log("  Update scripts/3-seed-secrets.ts agentWhitelist with your agent DID:");
    console.log(`  "${session.agentDid}"`);
    console.log("  Then re-run script 3 and this script.");
    return;
  }

  // ── 2. Balance query ────────────────────────────────────────────────────
  console.log("\n── 2. Balance query (inside TEE) ──");
  const TEST_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth
  const balance = await getBalance(session, TEST_ADDRESS, 11155111); // Sepolia
  console.log(`  address     : ${balance.address}`);
  console.log(`  balance_wei : ${balance.balance_wei}`);

  // ── 3. Simulated transfer ───────────────────────────────────────────────
  console.log("\n── 3. Transfer (TEE-verified) ──");
  const transfer = await executeTransfer(session, {
    to: "0x1234567890123456789012345678901234567890",
    amountWei: "500000000000000", // 0.0005 ETH
    chainId: 11155111,
  });
  console.log(`  success  : ${transfer.success}`);
  console.log(`  tx_hash  : ${transfer.tx_hash}`);
  if (transfer.error) console.log(`  error    : ${transfer.error}`);

  // ── 4. Queue a timelocked action ────────────────────────────────────────
  console.log("\n── 4. Queue timelocked action ──");
  const queued = await queueAction(session, {
    action: "approve",
    target: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    amountWei: "1000000",
    delaySeconds: 3600, // 1 hour timelock
  });
  console.log(`  queued          : ${queued.queued}`);
  console.log(`  queue_id        : ${queued.queue_id}`);
  console.log(`  executes_after  : ${queued.executes_after}s`);

  console.log("\n✓ Full demo complete — agent ran 4 TEE-verified operations");
  console.log("  All actions were policy-checked inside the T3N enclave.");
  console.log("  RPC URL and spending cap never left the TEE.");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
