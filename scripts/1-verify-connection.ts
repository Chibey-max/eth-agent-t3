/**
 * Script 1 — Verify T3N connection and check token balance
 * Run: ts-node scripts/1-verify-connection.ts
 */
import "dotenv/config";
import { createT3Session } from "../packages/eth-agent-kit/src/t3/client";

async function main() {
  console.log("=== Step 1: Verifying T3N connection ===\n");

  const session = await createT3Session();

  // Check token balance
  const usage = await session.tenant.getUsage?.() ?? { balance: { available: "unknown" } };
  console.log(`\n  tokens available : ${(usage as any).balance?.available ?? "check dashboard"}`);

  // Confirm tenant info
  const me = await session.tenant.me();
  console.log(`  tenant record    : ${JSON.stringify(me, null, 2)}`);

  console.log("\n✓ Connection verified. Proceed to step 2: build the WASM contract.");
  console.log("\n  cd tee-contract");
  console.log("  rustup target add wasm32-wasip2");
  console.log("  cargo build --target wasm32-wasip2 --release");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
