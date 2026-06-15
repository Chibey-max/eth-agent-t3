/**
 * Script 1 — Verify T3N connection and token balance
 * Run: npm run verify
 */
import "dotenv/config";
import {
  T3nClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  getNodeUrl,
  formatTokens,
} from "@terminal3/t3n-sdk";

async function main() {
  console.log("=== Step 1: Verifying T3N connection ===\n");

  const apiKey = process.env.T3N_API_KEY;
  if (!apiKey) throw new Error("T3N_API_KEY not set in .env");

  setEnvironment("testnet");
  const nodeUrl = getNodeUrl();
  console.log(`  node url : ${nodeUrl}`);

  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(apiKey);
  console.log(`  address  : ${address}`);

  const t3n = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, apiKey) },
  });

  await t3n.handshake();
  console.log("  ✓ handshake complete");

  const authResult = await t3n.authenticate(createEthAuthInput(address));
  const did = (authResult as any)?.did ?? process.env.T3N_DID;
  console.log(`  did      : ${did}`);

  // Token balance
  try {
    const usage = await t3n.getUsage?.();
    if (usage) {
      const avail = (usage as any).balance?.available ?? 0;
      console.log(`  tokens   : ${formatTokens(avail)} T3N`);
    }
  } catch {
    console.log("  tokens   : (getUsage not available on this version)");
  }

  console.log("\n✓ Connection verified — proceed to Step 2");
  console.log("  cd tee-contract && cargo build --target wasm32-wasip2 --release");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
