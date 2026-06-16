import { config } from "dotenv";
import { createT3Session } from "../packages/eth-agent-kit/src/t3/client.js";
import { createContractSession, checkPolicy, executeTransfer, queueAction } from "../packages/eth-agent-kit/src/t3/invoke.js";

config({ path: ".env", override: true });

const action = process.argv[2];
const body = JSON.parse(process.argv[3] || "{}");

function weiToEth(wei: string): string {
  let value = wei.replace(/^0+/, "");
  if (!value) return "0";

  if (value.length <= 18) {
    value = `0.${"0".repeat(18 - value.length)}${value}`;
  } else {
    value = `${value.slice(0, -18)}.${value.slice(-18)}`;
  }

  return value.replace(/0+$/, "").replace(/\.$/, "");
}

async function liveRpcBalance(address: string, chainId: number, fallbackReason: string) {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL not set");

  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getBalance",
      params: [address, "latest"],
      id: 1,
    }),
  };

  let res: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      res = await fetch(rpcUrl, request);
      break;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }

  if (!res) {
    throw lastError instanceof Error ? lastError : new Error("live RPC fetch failed");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`live RPC HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }

  const json = await res.json() as { result?: string; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || "live RPC error");

  const balanceWei = BigInt(json.result || "0x0").toString();
  return {
    address,
    chain_id: chainId,
    balance_wei: balanceWei,
    balance_eth: weiToEth(balanceWei),
    live_rpc: true,
    tee_verified: false,
    fallback_reason: fallbackReason,
    note: "live Sepolia balance read by dashboard bridge because T3N testnet host HTTP/KV imports are unavailable",
  };
}

function isTransientT3nError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("fetch failed") ||
    message.includes("Failed to fetch node status") ||
    message.includes("EAI_AGAIN") ||
    message.includes("ETIMEDOUT");
}

async function runTeeAction() {
  const session = await createT3Session();
  const contract = await createContractSession(session.tenant);

  switch (action) {
    case "check-policy":
      return checkPolicy(contract, session.tenantDid, body.action || "transfer", body.amountWei);
    case "execute-transfer":
      return executeTransfer(contract, { to: body.to, amountWei: body.amountWei, chainId: body.chainId ?? 11155111 });
    case "queue-action":
      return queueAction(contract, { action: body.action || "approve", target: body.target, amountWei: body.amountWei, delaySeconds: body.delaySeconds ?? 3600 });
    default:
      return { error: "unknown action: " + action };
  }
}

async function main() {
  if (action === "get-balance") {
    const result = await liveRpcBalance(
      body.address,
      body.chainId ?? 11155111,
      "T3N testnet runtime did not wire HTTP/KV host imports for live in-TEE RPC"
    );
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }

  let result: unknown;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await runTeeAction();
      process.stdout.write(JSON.stringify(result) + "\n");
      return;
    } catch (err) {
      lastError = err;
      if (!isTransientT3nError(err) || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  throw lastError;
}

main().catch(e => { process.stdout.write(JSON.stringify({ error: e.message }) + "\n"); process.exit(0); });
