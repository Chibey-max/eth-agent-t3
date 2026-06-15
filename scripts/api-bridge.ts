import "dotenv/config";
import { createT3Session } from "../packages/eth-agent-kit/src/t3/client.js";
import { createContractSession, checkPolicy, getBalance, executeTransfer, queueAction } from "../packages/eth-agent-kit/src/t3/invoke.js";

const action = process.argv[2];
const body = JSON.parse(process.argv[3] || "{}");

async function main() {
  const session = await createT3Session();
  const contract = await createContractSession(session.tenant);
  let result: unknown;
  switch (action) {
    case "check-policy":
      result = await checkPolicy(contract, session.tenantDid, body.action || "transfer", body.amountWei);
      break;
    case "get-balance":
      result = await getBalance(contract, body.address, body.chainId ?? 11155111);
      break;
    case "execute-transfer":
      result = await executeTransfer(contract, { to: body.to, amountWei: body.amountWei, chainId: body.chainId ?? 11155111 });
      break;
    case "queue-action":
      result = await queueAction(contract, { action: body.action || "approve", target: body.target, amountWei: body.amountWei, delaySeconds: body.delaySeconds ?? 3600 });
      break;
    default:
      result = { error: "unknown action: " + action };
  }
  process.stdout.write(JSON.stringify(result) + "\n");
}

main().catch(e => { process.stdout.write(JSON.stringify({ error: e.message }) + "\n"); process.exit(0); });
