import {
  T3nClient,
  TenantClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  getNodeUrl,
} from "@terminal3/t3n-sdk";

export interface T3Session {
  t3n: T3nClient;
  tenant: TenantClient;
  tenantDid: string;
  address: string;
}

/**
 * Initialises a T3N authenticated session.
 * Call this once at startup — reuse the returned session object.
 *
 * Follows the exact pattern from:
 * https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env
 */
export async function createT3Session(): Promise<T3Session> {
  const apiKey = process.env.T3N_API_KEY;
  if (!apiKey) throw new Error("T3N_API_KEY not set in environment");

  // "testnet" resolves the cluster URL automatically — never hard-code a node URL
  setEnvironment("testnet");

  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(apiKey);

  const t3n = new T3nClient({
    wasmComponent,
    handlers: {
      // EthSign is the only handler you provide — the client adds MlKemPublicKey
      // and Random handlers itself
      EthSign: metamask_sign(address, undefined, apiKey),
    },
  });

  // Open an encrypted session in the TEE
  await t3n.handshake();

  // Authenticate — read the DID back from the session, never hard-code it
  const did = await t3n.authenticate(createEthAuthInput(address));
  const tenantDid = did.value; // did:t3n:<40hex>

  const tenant = new TenantClient({
    t3n,
    baseUrl: getNodeUrl(),
    tenantDid,
  });

  console.log(`✓ T3N session established`);
  console.log(`  address : ${address}`);
  console.log(`  did     : ${tenantDid}`);

  return { t3n, tenant, tenantDid, address };
}
