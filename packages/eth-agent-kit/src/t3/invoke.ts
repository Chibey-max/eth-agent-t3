/**
 * Contract invocation — uses the real TenantClient.contracts.execute() API.
 *
 * Real SDK:
 *   TenantClient.contracts.execute(tail, { version, functionName, input })
 *   TenantClient.canonicalName(tail) -> full script name
 *   getScriptVersion(nodeUrl, scriptName) -> semver string
 */
import {
  getScriptVersion,
  getNodeUrl,
} from "@terminal3/t3n-sdk";
import type { TenantClient } from "@terminal3/t3n-sdk";
import { CONTRACT_TAIL, CONTRACT_VERSION } from "./register.js";

export interface ContractSession {
  tenant: TenantClient;
  scriptName: string;
  version: string;
}

export async function createContractSession(tenant: TenantClient): Promise<ContractSession> {
  const scriptName = tenant.canonicalName(CONTRACT_TAIL);
  let version = CONTRACT_VERSION;
  try {
    version = await getScriptVersion(getNodeUrl(), scriptName);
  } catch {
    // fall back to published version
  }
  return { tenant, scriptName, version };
}

// ── contract function callers ─────────────────────────────────────────────

async function call<T>(
  session: ContractSession,
  functionName: string,
  input: Record<string, unknown>
): Promise<T> {
  const result = await session.tenant.contracts.execute(CONTRACT_TAIL, {
    version: session.version,
    functionName,
    input,
  });
  return result as T;
}

export async function checkPolicy(
  session: ContractSession,
  agentDid: string,
  action: string,
  amountWei?: string
) {
  return call<{ allowed: boolean; reason: string }>(session, "check-policy", {
    agent_did: agentDid,
    action,
    amount_wei: amountWei,
  });
}

export async function executeTransfer(
  session: ContractSession,
  params: { to: string; amountWei: string; chainId: number; token?: string }
) {
  return call<{ success: boolean; tx_hash?: string; error?: string }>(
    session,
    "execute-transfer",
    {
      agent_did: process.env.T3N_DID!,
      to: params.to,
      amount_wei: params.amountWei,
      chain_id: params.chainId,
      token: params.token,
    }
  );
}

export async function getBalance(
  session: ContractSession,
  address: string,
  chainId: number
) {
  return call<{ address: string; balance_wei: string }>(session, "get-balance", {
    address,
    chain_id: chainId,
  });
}

export async function queueAction(
  session: ContractSession,
  params: {
    action: string;
    target: string;
    amountWei?: string;
    calldata?: string;
    delaySeconds: number;
  }
) {
  return call<{ queued: boolean; queue_id: string; executes_after: number }>(
    session,
    "queue-action",
    {
      agent_did: process.env.T3N_DID!,
      action: params.action,
      target: params.target,
      amount_wei: params.amountWei,
      calldata: params.calldata,
      delay_seconds: params.delaySeconds,
    }
  );
}

// ── payroll contract functions ────────────────────────────────────────────

export async function enrollEmployee(
  session: ContractSession,
  params: {
    employeeDid: string;
    salaryWei: string;
    currency: string;
    bandMinWei: string;
    bandMaxWei: string;
  }
) {
  return call<{ enrolled: boolean; employee_did: string }>(
    session,
    "enroll-employee",
    {
      employee_did: params.employeeDid,
      salary_wei: params.salaryWei,
      currency: params.currency,
      band_min_wei: params.bandMinWei,
      band_max_wei: params.bandMaxWei,
    }
  );
}

export async function verifyEmployee(
  session: ContractSession,
  employeeDid: string
) {
  return call<{ verified: boolean; reason: string; salary_wei?: string }>(
    session,
    "verify-employee",
    { employee_did: employeeDid }
  );
}

export async function processPayroll(
  session: ContractSession,
  params: {
    employeeDid: string;
    amountWei: string;
    disburseUrl: string;
    idempotencyKey: string;
  }
) {
  return call<{ paid: boolean; reason: string; http_status: number }>(
    session,
    "process-payroll",
    {
      employee_did: params.employeeDid,
      amount_wei: params.amountWei,
      disburse_url: params.disburseUrl,
      idempotency_key: params.idempotencyKey,
    }
  );
}
