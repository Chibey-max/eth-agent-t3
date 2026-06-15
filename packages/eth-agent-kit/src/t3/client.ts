/**
 * T3N session setup — rewritten against the real @terminal3/t3n-sdk exports.
 *
 * Real exports used:
 *   T3nClient, TenantClient, setEnvironment, loadWasmComponent,
 *   eth_get_address, metamask_sign, createEthAuthInput, getNodeUrl
 */
import {
  T3nClient,
  TenantClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  getNodeUrl,
  formatTokens,
} from "@terminal3/t3n-sdk";

export interface T3Session {
  t3n: T3nClient;
  tenant: TenantClient;
  tenantDid: string;
  address: string;
  nodeUrl: string;
}

export async function createT3Session(): Promise<T3Session> {
  const apiKey = process.env.T3N_API_KEY;
  if (!apiKey) throw new Error("T3N_API_KEY not set in .env");

  setEnvironment("testnet");
  const nodeUrl = getNodeUrl();

  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(apiKey);

  const t3n = new T3nClient({
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, apiKey),
    },
  });

  // 1. Establish encrypted channel with the TEE
  await t3n.handshake();

  // 2. Authenticate — returns the authenticated DID
  const authResult = await t3n.authenticate(createEthAuthInput(address));
  // The DID comes back in authResult; fall back to env var if shape differs
  const tenantDid =
    (authResult as Record<string, unknown>)?.did as string ??
    process.env.T3N_DID!;

  // 3. Build the tenant control-plane client
  const tenant = new TenantClient({
    environment: "testnet",
    t3n,
    baseUrl: nodeUrl,
    tenantDid,
  });

  // Show token balance so you know you have credits
  try {
    const usage = await t3n.getUsage?.();
    if (usage) {
      const balance = (usage as any).balance?.available ?? 0;
      console.log(`  tokens available: ${formatTokens(balance)}`);
    }
  } catch { /* non-fatal */ }

  console.log(`✓ T3N session`);
  console.log(`  address : ${address}`);
  console.log(`  did     : ${tenantDid}`);
  console.log(`  node    : ${nodeUrl}`);

  return { t3n, tenant, tenantDid, address, nodeUrl };
}
