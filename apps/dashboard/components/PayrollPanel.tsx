"use client";
import { useState } from "react";

interface Row {
  name: string;
  employee_did: string;
  proposed_wei: string;
  status: "idle" | "proposing" | "validating" | "paid" | "blocked";
  reason?: string;
}

const SEED: Row[] = [
  { name: "Alice", employee_did: "did:t3n:alice", proposed_wei: "5000000000000000000", status: "idle" },
  { name: "Bob", employee_did: "did:t3n:bob", proposed_wei: "2000000000000000000", status: "idle" },
  { name: "Eve", employee_did: "did:t3n:eve", proposed_wei: "1000000000000000000000", status: "idle" },
];

function ethStr(wei: string): string {
  try {
    return (Number(BigInt(wei) / BigInt(1e15)) / 1000).toLocaleString() + " ETH";
  } catch {
    return wei;
  }
}

export default function PayrollPanel() {
  const [rows, setRows] = useState<Row[]>(SEED);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      // 1. AI proposes
      setRows((r) => r.map((x, j) => (j === i ? { ...x, status: "proposing" } : x)));
      await new Promise((res) => setTimeout(res, 600));
      // 2. TEE validates
      setRows((r) => r.map((x, j) => (j === i ? { ...x, status: "validating" } : x)));
      await new Promise((res) => setTimeout(res, 700));
      // 3. Verdict — Eve's inflated amount is blocked by the band check
      setRows((r) =>
        r.map((x, j) => {
          if (j !== i) return x;
          const inflated = BigInt(x.proposed_wei) > BigInt("10000000000000000000");
          return inflated
            ? { ...x, status: "blocked", reason: "amount outside enrolled salary band" }
            : { ...x, status: "paid", reason: "disbursed — bank details substituted in TEE" };
        })
      );
    }
    setRunning(false);
  }

  const COLOR: Record<Row["status"], string> = {
    idle: "#475569",
    proposing: "#00d4ff",
    validating: "#f59e0b",
    paid: "#00ff88",
    blocked: "#ef4444",
  };
  const LABEL: Record<Row["status"], string> = {
    idle: "—",
    proposing: "AI PROPOSING",
    validating: "TEE VALIDATING",
    paid: "✓ PAID",
    blocked: "✗ BLOCKED BY TEE",
  };

  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #1e2a3a",
        borderRadius: 12,
        padding: "1.5rem",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", letterSpacing: 1 }}>
          AI PAYROLL RUN · TEE-GUARDED
        </h2>
        <button
          onClick={run}
          disabled={running}
          style={{
            background: running ? "#1e2a3a" : "#00ff8811",
            border: "1px solid #00ff8844",
            borderRadius: 6,
            color: "#00ff88",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            padding: "0.5rem 1rem",
            cursor: running ? "default" : "pointer",
          }}
        >
          {running ? "⟳ running..." : "▶ run payroll"}
        </button>
      </div>

      {rows.map((row) => (
        <div
          key={row.employee_did}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: "1rem",
            alignItems: "center",
            padding: "0.75rem 0",
            borderBottom: "1px solid #131a23",
          }}
        >
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 14 }}>{row.name}</div>
            <div style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
              {row.employee_did}
            </div>
          </div>
          <div style={{ color: "#cbd5e1", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, textAlign: "right" }}>
            {ethStr(row.proposed_wei)}
          </div>
          <div
            style={{
              color: COLOR[row.status],
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: 1,
              minWidth: 130,
              textAlign: "right",
            }}
          >
            {LABEL[row.status]}
          </div>
        </div>
      ))}

      <p style={{ color: "#475569", fontSize: 11, marginTop: "1rem", fontFamily: "'JetBrains Mono', monospace" }}>
        // Eve&apos;s row carries a prompt-injection in its notes. The TEE band-check
        <br />
        // blocks the inflated payout regardless of what the model decides.
      </p>
    </div>
  );
}
