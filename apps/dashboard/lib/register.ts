/**
 * Contract registration — uses tenant.contracts.publish() from real SDK.
 *
 * Real API:
 *   TenantClient.contracts.publish({ tail, version, wasm: Uint8Array })
 *   TenantClient.canonicalName(tail) -> "z:<hex>:<tail>"
 *   getScriptVersion(nodeUrl, scriptName) -> semver string
 */
import { readFile } from "fs/promises";
import { join } from "path";
import { getScriptVersion, getNodeUrl } from "@terminal3/t3n-sdk";
import type { TenantClient } from "@terminal3/t3n-sdk";

export const CONTRACT_TAIL = "eth-agent-contracts";
export const CONTRACT_VERSION = "0.1.0";

export async function registerContract(tenant: TenantClient) {
  const wasmPath = join(
    process.cwd(),
    "tee-contract/target/wasm32-wasip2/release/z_eth_agent.wasm"
  );

  let wasmBytes: Buffer;
  try {
    wasmBytes = await readFile(wasmPath);
  } catch {
    throw new Error(
      `WASM not found at ${wasmPath}\n` +
        `Run first:\n  cd tee-contract && cargo build --target wasm32-wasip2 --release`
    );
  }

  console.log(`Uploading WASM (${(wasmBytes.length / 1024).toFixed(1)} KB)...`);

  // Real SDK: tenant.contracts.publish uploads the WASM component
  const result = await tenant.contracts.publish({
    tail: CONTRACT_TAIL,
    version: CONTRACT_VERSION,
    wasm: new Uint8Array(wasmBytes),
  });

  const scriptName = tenant.canonicalName(CONTRACT_TAIL);

  console.log(`✓ Contract published`);
  console.log(`  script name : ${scriptName}`);
  console.log(`  version     : ${CONTRACT_VERSION}`);
  if (result) console.log(`  response    :`, JSON.stringify(result).slice(0, 120));

  return { scriptName, version: CONTRACT_VERSION, result };
}

/** Resolve the live version from the node (use after publish). */
export async function resolveScriptVersion(scriptName: string): Promise<string> {
  try {
    return await getScriptVersion(getNodeUrl(), scriptName);
  } catch {
    return CONTRACT_VERSION; // fall back to what we published
  }
}
