import { readFile } from "fs/promises";
import { join } from "path";
import type { TenantClient } from "@terminal3/t3n-sdk";

export const CONTRACT_TAIL = "eth-agent-contracts";
export const CONTRACT_VERSION = "0.1.0";

// Full z-namespace script name — built from tenantDid at runtime
export function scriptName(tenantDid: string): string {
  const tid = tenantDid.slice("did:t3n:".length);
  return `z:${tid}:${CONTRACT_TAIL}`;
}

/**
 * Uploads the compiled WASM to T3N and returns the numeric contract ID.
 * The contract ID is needed to set KV map ACLs in the next step.
 *
 * Follows: https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract
 */
export async function registerContract(
  tenant: TenantClient,
  tenantDid: string
): Promise<{ contractId: number; scriptName: string }> {
  const wasmPath = join(
    __dirname,
    "../../../../tee-contract/target/wasm32-wasip2/release/z_eth_agent.wasm"
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

  console.log(`Registering WASM (${wasmBytes.length} bytes)...`);

  const result = await tenant.contracts.register({
    tail: CONTRACT_TAIL,
    version: CONTRACT_VERSION,
    wasm: wasmBytes,
  });

  const name = scriptName(tenantDid);
  console.log(`✓ Contract registered`);
  console.log(`  script  : ${name}`);
  console.log(`  id      : ${result.contract_id}`);

  return { contractId: result.contract_id, scriptName: name };
}
