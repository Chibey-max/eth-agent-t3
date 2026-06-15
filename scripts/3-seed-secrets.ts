/**
 * Script 3 — Create KV maps and seal secrets into TEE
 * Run: npm run seed
 */
import "dotenv/config";
import { createT3Session } from "../packages/eth-agent-kit/src/t3/client.js";
import { setupMapsAndSecrets } from "../packages/eth-agent-kit/src/t3/secrets.js";

async function main() {
  console.log("=== Step 3: Sealing secrets into T3N TEE ===\n");

  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL not set");

  const tenantDid = process.env.T3N_DID;
  if (!tenantDid) throw new Error("T3N_DID not set");

  const session = await createT3Session();

  await setupMapsAndSecrets(session.tenant, {
    rpcUrl,
    agentWhitelist: [tenantDid],         // tenant DID can call all functions
    spendingCapWei: "1000000000000000",  // 0.001 ETH per action
  });

  console.log("\n✓ Secrets sealed. Next: npm run invoke");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
