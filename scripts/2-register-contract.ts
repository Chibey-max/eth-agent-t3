/**
 * Script 2 — Register the compiled WASM contract on T3N testnet
 * Run AFTER: cargo build --target wasm32-wasip2 --release
 * Run: ts-node scripts/2-register-contract.ts
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { createT3Session } from "../packages/eth-agent-kit/src/t3/client";
import { registerContract } from "../packages/eth-agent-kit/src/t3/register";

async function main() {
  console.log("=== Step 2: Registering TEE contract on T3N ===\n");

  const session = await createT3Session();
  const { contractId, scriptName } = await registerContract(session.tenant, session.tenantDid);

  // Save contract ID for next scripts
  const config = { contractId, scriptName, tenantDid: session.tenantDid };
  writeFileSync(".contract-config.json", JSON.stringify(config, null, 2));

  console.log("\n✓ Saved contract config to .contract-config.json");
  console.log("  Proceed to step 3: seed secrets.");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
