/**
 * Script 3 — Create KV maps and seed all secrets into the TEE
 * Run: ts-node scripts/3-seed-secrets.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { createT3Session } from "../packages/eth-agent-kit/src/t3/client";
import { setupMapsAndSecrets } from "../packages/eth-agent-kit/src/t3/secrets";

async function main() {
  console.log("=== Step 3: Seeding secrets into T3N TEE ===\n");

  // Load contract ID from previous step
  let contractConfig: { contractId: number; scriptName: string; tenantDid: string };
  try {
    contractConfig = JSON.parse(readFileSync(".contract-config.json", "utf-8"));
  } catch {
    throw new Error("Run script 2 first: ts-node scripts/2-register-contract.ts");
  }

  // Validate required env vars
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL not set in .env");

  const agentKey = process.env.AGENT_PRIVATE_KEY;
  if (!agentKey) throw new Error("AGENT_PRIVATE_KEY not set in .env");

  const session = await createT3Session();

  await setupMapsAndSecrets(session.tenant, contractConfig.contractId, {
    rpcUrl,
    // Whitelist: the agent's T3N DID — will be resolved after agent authenticates
    // For now we seed the ETH address as identifier; update after running script 4
    agentWhitelist: [agentKey.slice(0, 42)], // placeholder — update with real agent DID
    spendingCapWei: "1000000000000000", // 0.001 ETH max per action
  });

  console.log("\n✓ Secrets sealed. Proceed to step 4: invoke the agent.");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
