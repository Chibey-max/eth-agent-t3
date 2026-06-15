import { NextRequest, NextResponse } from "next/server";

// These API routes proxy calls to the T3N TEE contract
// In production, the session would be cached per-user

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  const body = await req.json();
  const { action } = params;

  // Dynamically import to avoid edge runtime issues
  const { createAgentSession, checkPolicy, getBalance, executeTransfer, queueAction } =
    await import("eth-agent-kit");

  const tenantDid = process.env.T3N_DID;
  if (!tenantDid) {
    return NextResponse.json({ error: "T3N_DID not configured" }, { status: 500 });
  }

  try {
    const session = await createAgentSession(tenantDid);

    let result: unknown;

    switch (action) {
      case "check-policy":
        result = await checkPolicy(session, session.agentDid, body.action, body.amountWei);
        break;

      case "get-balance":
        result = await getBalance(session, body.address, body.chainId ?? 11155111);
        break;

      case "transfer":
        result = await executeTransfer(session, {
          to: body.to,
          amountWei: body.amountWei,
          chainId: body.chainId ?? 11155111,
          token: body.token,
        });
        break;

      case "queue":
        result = await queueAction(session, {
          action: body.action,
          target: body.target,
          amountWei: body.amountWei,
          calldata: body.calldata,
          delaySeconds: body.delaySeconds ?? 3600,
        });
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ agentDid: session.agentDid, ...((result as object) ?? {}) });
  } catch (err: any) {
    console.error(`[agent/${action}]`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
