/**
 * Script 4 — End-to-end contract invocation demo
 * Run: npm run invoke
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { createT3Session } from "../packages/eth-agent-kit/src/t3/client.js";
import {
  createContractSession,
  checkPolicy,
  getBalance,
  executeTransfer,
  queueAction,
} from "../packages/eth-agent-kit/src/t3/invoke.js";

async function main() {
  console.log("=== Step 4: End-to-end contract invocation ===\n");

  const session = await createT3Session();
  const contract = await createContractSession(session.tenant);

  console.log(`  script : ${contract.scriptName}`);
  console.log(`  version: ${contract.version}\n`);

  // 1. Policy check
  console.log("── 1. Policy check ──");
  try {
    const policy = await checkPolicy(
      contract,
      session.tenantDid,
      "transfer",
      "500000000000000"
    );
    console.log(`  allowed : ${policy.allowed}`);
    console.log(`  reason  : ${policy.reason}`);
  } catch (e: any) {
    console.log(`  ⚠ policy check error: ${e.message}`);
  }

  // 2. Balance query
  console.log("\n── 2. Balance query (inside TEE) ──");
  try {
    const bal = await getBalance(contract, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", 11155111);
    console.log(`  address     : ${bal.address}`);
    console.log(`  balance_wei : ${bal.balance_wei}`);
  } catch (e: any) {
    console.log(`  ⚠ balance error: ${e.message}`);
  }

  // 3. Simulated transfer
  console.log("\n── 3. TEE-verified transfer ──");
  try {
    const tx = await executeTransfer(contract, {
      to: "0x1234567890123456789012345678901234567890",
      amountWei: "500000000000000",
      chainId: 11155111,
    });
    console.log(`  success : ${tx.success}`);
    console.log(`  tx_hash : ${tx.tx_hash}`);
  } catch (e: any) {
    console.log(`  ⚠ transfer error: ${e.message}`);
  }

  // 4. Queue a timelocked action
  console.log("\n── 4. Timelocked action queue ──");
  try {
    const q = await queueAction(contract, {
      action: "approve",
      target: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      amountWei: "1000000",
      delaySeconds: 3600,
    });
    console.log(`  queued         : ${q.queued}`);
    console.log(`  queue_id       : ${q.queue_id}`);
    console.log(`  executes_after : ${q.executes_after}s`);
  } catch (e: any) {
    console.log(`  ⚠ queue error: ${e.message}`);
  }

  console.log("\n✓ Demo complete. Next: npm run payroll");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
