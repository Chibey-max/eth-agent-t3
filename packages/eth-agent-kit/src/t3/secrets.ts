import type { TenantClient } from "@terminal3/t3n-sdk";

export interface SecretsConfig {
  rpcUrl: string;
  agentWhitelist: string[];   // list of did:t3n or ETH addresses to whitelist
  spendingCapWei: string;     // max wei per action e.g. "1000000000000000" = 0.001 ETH
}

/**
 * Creates the secrets KV map and seeds all required values.
 * Uses map-entry-set control call — bypasses ACL to write initial secrets.
 *
 * Follows:
 * https://docs.terminal3.io/developers/adk/tips/create-kv-maps
 * https://docs.terminal3.io/developers/adk/tips/seed-api-key
 */
export async function setupMapsAndSecrets(
  tenant: TenantClient,
  contractId: number,
  config: SecretsConfig
): Promise<void> {
  // 1. Create secrets map (private, only the contract can read/write)
  console.log("Creating secrets map...");
  try {
    await tenant.maps.create({
      tail: "secrets",
      visibility: "private",
      writers: { only: [contractId] },
      readers: { only: [contractId] }, // REQUIRED — KV governor defaults to deny
    });
    console.log("✓ secrets map created");
  } catch (err: any) {
    if (err?.message?.includes("MapAlreadyExists")) {
      console.log("✓ secrets map already exists (skipping)");
    } else {
      throw err;
    }
  }

  // 2. Create queue map for timelocked actions
  console.log("Creating queue map...");
  try {
    await tenant.maps.create({
      tail: "queue",
      visibility: "private",
      writers: { only: [contractId] },
      readers: { only: [contractId] },
    });
    console.log("✓ queue map created");
  } catch (err: any) {
    if (err?.message?.includes("MapAlreadyExists")) {
      console.log("✓ queue map already exists (skipping)");
    } else {
      throw err;
    }
  }

  // 3. Seed secrets via control-plane write (bypasses ACL)
  console.log("Seeding secrets...");

  await tenant.executeControl("map-entry-set", {
    map_name: tenant.canonicalName("secrets"),
    key: "rpc_url",
    value: config.rpcUrl,
  });
  console.log("  ✓ rpc_url sealed");

  await tenant.executeControl("map-entry-set", {
    map_name: tenant.canonicalName("secrets"),
    key: "agent_whitelist",
    value: JSON.stringify(config.agentWhitelist),
  });
  console.log(`  ✓ agent_whitelist sealed (${config.agentWhitelist.length} entries)`);

  await tenant.executeControl("map-entry-set", {
    map_name: tenant.canonicalName("secrets"),
    key: "spending_cap_wei",
    value: config.spendingCapWei,
  });
  console.log(`  ✓ spending_cap_wei sealed (${config.spendingCapWei} wei)`);

  console.log("\n✓ All secrets sealed in TEE — not readable outside the enclave");
}
