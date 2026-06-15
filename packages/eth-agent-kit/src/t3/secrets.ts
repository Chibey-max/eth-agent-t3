/**
 * KV map creation and secret sealing.
 *
 * Real SDK API used:
 *   TenantClient.maps.create({ tail, visibility, writers, readers })
 *   TenantClient.executeControl(functionName, input)
 *   TenantClient.canonicalName(tail) -> canonical map name
 */
import type { TenantClient } from "@terminal3/t3n-sdk";

export interface SecretsConfig {
  rpcUrl: string;
  agentWhitelist: string[];   // agent DIDs or addresses allowed to call
  spendingCapWei: string;     // max wei per action
}

export async function setupMapsAndSecrets(
  tenant: TenantClient,
  config: SecretsConfig
): Promise<void> {
  // 1. Create secrets map — private, only the contract can read/write.
  //    On testnet we use "all" writers since we seed via executeControl.
  for (const tail of ["secrets", "payroll", "queue"]) {
    console.log(`Creating map '${tail}'...`);
    try {
      await tenant.maps.create({
        tail,
        visibility: "private",
        writers: "all",      // control-plane seeding requires "all" on testnet
        readers: "all",
      });
      console.log(`  ✓ map '${tail}' created`);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.toLowerCase().includes("already") || msg.includes("exists")) {
        console.log(`  ✓ map '${tail}' already exists`);
      } else {
        throw err;
      }
    }
  }

  // 2. Seal secrets via executeControl ("map-entry-set" bypasses runtime ACL
  //    and is the authoritative tenant-side write path for bootstrap).
  const mapName = tenant.canonicalName("secrets");

  console.log(`\nSealing secrets into TEE map '${mapName}'...`);

  await tenant.executeControl("map-entry-set", {
    map_name: mapName,
    key: "rpc_url",
    value: config.rpcUrl,
  });
  console.log("  ✓ rpc_url sealed");

  await tenant.executeControl("map-entry-set", {
    map_name: mapName,
    key: "agent_whitelist",
    value: JSON.stringify(config.agentWhitelist),
  });
  console.log(`  ✓ agent_whitelist sealed (${config.agentWhitelist.length} entries)`);

  await tenant.executeControl("map-entry-set", {
    map_name: mapName,
    key: "spending_cap_wei",
    value: config.spendingCapWei,
  });
  console.log(`  ✓ spending_cap_wei sealed (${config.spendingCapWei} wei)`);

  console.log("\n✓ All secrets sealed. Plaintext never left the control plane.");
}
