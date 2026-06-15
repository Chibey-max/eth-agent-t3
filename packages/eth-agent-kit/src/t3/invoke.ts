import {
  T3nClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  getScriptVersion,
  getNodeUrl,
} from "@terminal3/t3n-sdk";
import { scriptName } from "./register";

export interface AgentSession {
  agentClient: T3nClient;
  agentDid: string;
  scriptName: string;
  scriptVersion: string;
}

/**
 * Creates a T3N session for the *agent* (not the tenant/owner).
 * Agents authenticate as themselves — their DID is read from the session.
 *
 * Follows: https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract
 */
export async function createAgentSession(tenantDid: string): Promise<AgentSession> {
  const agentKey = process.env.AGENT_PRIVATE_KEY;
  if (!agentKey) throw new Error("AGENT_PRIVATE_KEY not set");

  setEnvironment("testnet");

  const wasmComponent = await loadWasmComponent();
  const agentAddress = eth_get_address(agentKey);

  const agentClient = new T3nClient({
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(agentAddress, undefined, agentKey),
    },
  });

  await agentClient.handshake();
  const did = await agentClient.authenticate(createEthAuthInput(agentAddress));
  const agentDid = did.value;

  const name = scriptName(tenantDid);
  const version = await getScriptVersion(getNodeUrl(), name);

  console.log(`✓ Agent session established`);
  console.log(`  agent did     : ${agentDid}`);
  console.log(`  contract      : ${name}@${version}`);

  return { agentClient, agentDid, scriptName: name, scriptVersion: version };
}

// ── Contract function callers ──────────────────────────────────────────────

export async function checkPolicy(
  session: AgentSession,
  agentDid: string,
  action: string,
  amountWei?: string
): Promise<{ allowed: boolean; reason: string }> {
  return session.agentClient.executeAndDecode({
    script_name: session.scriptName,
    script_version: session.scriptVersion,
    function_name: "check-policy",
    input: { agent_did: agentDid, action, amount_wei: amountWei },
  });
}

export async function executeTransfer(
  session: AgentSession,
  params: {
    to: string;
    amountWei: string;
    chainId: number;
    token?: string;
  }
): Promise<{ success: boolean; tx_hash?: string; error?: string }> {
  return session.agentClient.executeAndDecode({
    script_name: session.scriptName,
    script_version: session.scriptVersion,
    function_name: "execute-transfer",
    input: {
      agent_did: session.agentDid,
      to: params.to,
      amount_wei: params.amountWei,
      chain_id: params.chainId,
      token: params.token,
    },
  });
}

export async function getBalance(
  session: AgentSession,
  address: string,
  chainId: number
): Promise<{ address: string; balance_wei: string }> {
  return session.agentClient.executeAndDecode({
    script_name: session.scriptName,
    script_version: session.scriptVersion,
    function_name: "get-balance",
    input: { address, chain_id: chainId },
  });
}

export async function queueAction(
  session: AgentSession,
  params: {
    action: string;
    target: string;
    amountWei?: string;
    calldata?: string;
    delaySeconds: number;
  }
): Promise<{ queued: boolean; queue_id: string; executes_after: number }> {
  return session.agentClient.executeAndDecode({
    script_name: session.scriptName,
    script_version: session.scriptVersion,
    function_name: "queue-action",
    input: {
      agent_did: session.agentDid,
      action: params.action,
      target: params.target,
      amount_wei: params.amountWei,
      calldata: params.calldata,
      delay_seconds: params.delaySeconds,
    },
  });
}
