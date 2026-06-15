import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const exec = promisify(execFile);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  const body = await req.json();
  const { action } = params;
  const root = path.resolve(process.cwd(), "../..");
  const actionMap: Record<string, string> = {
    "check-policy": "check-policy",
    "get-balance": "get-balance",
    "transfer": "execute-transfer",
    "queue": "queue-action",
  };
  if (!actionMap[action]) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const tsx = path.join(root, "node_modules/.bin/tsx");
    const bridge = path.join(root, "scripts/api-bridge.ts");
    const { stdout } = await exec(tsx, [bridge, actionMap[action], JSON.stringify(body)], {
      cwd: root,
      env: { ...process.env },
      timeout: 30000,
    });
    const lines = stdout.trim().split("\n").filter(l => l.startsWith("{") || l.startsWith("["));
    const result = JSON.parse(lines[lines.length - 1] || "{}");
    return NextResponse.json(result);
  } catch (err: any) {
    const msg = err.stderr || err.message;
    return NextResponse.json({ error: msg.split("\n")[0] }, { status: 500 });
  }
}
