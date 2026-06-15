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
  nodeUrl: string;
}

let cachedSession: T3Session | null = null;

export async function createT3Session(): Promise<T3Session> {
  if (cachedSession) return cachedSession;

  const apiKey = process.env.T3N_API_KEY;
  if (!apiKey) throw new Error("T3N_API_KEY not set");

  setEnvironment("testnet");
  const nodeUrl = getNodeUrl();

  // loadWasmComponent uses a relative import internally.
  // Change cwd so it resolves correctly.
  const orig = process.chdir;
  const sdkDir = require.resolve("@terminal3/t3n-sdk").replace("/dist/index.js", "");
  process.chdir(sdkDir);

  let wasmComponent: any;
  try {
    wasmComponent = await loadWasmComponent();
  } finally {
    process.chdir(require("path").resolve(__dirname, "../../.."));
  }

  const address = eth_get_address(apiKey);

  const t3n = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, apiKey) },
  });

  await t3n.handshake();

  const authResult = await t3n.authenticate(createEthAuthInput(address));
  const tenantDid =
    (authResult as Record<string, unknown>)?.did as string ??
    process.env.T3N_DID!;

  const tenant = new TenantClient({
    environment: "testnet",
    t3n,
    baseUrl: nodeUrl,
    tenantDid,
  });

  cachedSession = { t3n, tenant, tenantDid, address, nodeUrl };
  return cachedSession;
}
