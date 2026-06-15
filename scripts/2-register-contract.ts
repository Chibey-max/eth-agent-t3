/**
 * Script 2 — Publish WASM contract to T3N testnet
 * Run AFTER: cd tee-contract && cargo build --target wasm32-wasip2 --release
 * Run: npm run register
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { createT3Session } from "../packages/eth-agent-kit/src/t3/client.js";
import { registerContract } from "../packages/eth-agent-kit/src/t3/register.js";

async function main() {
  console.log("=== Step 2: Publishing TEE contract to T3N ===\n");

  const session = await createT3Session();
  const { scriptName, version } = await registerContract(session.tenant);

  // Save for subsequent scripts
  const cfg = { scriptName, version, tenantDid: session.tenantDid };
  writeFileSync(".contract-config.json", JSON.stringify(cfg, null, 2));
  console.log("\n✓ Saved .contract-config.json");
  console.log("  Next: npm run seed");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
