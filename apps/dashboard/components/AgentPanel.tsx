"use client";
import { useState } from "react";
import type { LogEntry } from "../app/page";

interface Props {
  onLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  onAgentDid: (did: string) => void;
  onPolicyStatus: (s: "idle" | "allowed" | "denied") => void;
}

const BTN = {
  background: "transparent",
  border: "1px solid #00d4ff44",
  borderRadius: 6,
  color: "#00d4ff",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 13,
  padding: "0.6rem 1rem",
  cursor: "pointer",
  width: "100%",
  marginBottom: 8,
  textAlign: "left" as const,
  transition: "all 0.15s",
};

export default function AgentPanel({ onLog, onAgentDid, onPolicyStatus }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [toAddress, setToAddress] = useState("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  const [amount, setAmount] = useState("500000000000000");

  async function callApi(endpoint: string, body: object, type: LogEntry["type"]) {
    setLoading(endpoint);
    try {
      const res = await fetch(`/api/agent/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.agentDid) onAgentDid(data.agentDid);
      if (data.allowed !== undefined) {
        onPolicyStatus(data.allowed ? "allowed" : "denied");
      }
      onLog({ type, message: `${endpoint} completed`, data });
    } catch (err: any) {
      onLog({ type: "error", message: err.message });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #1e2a3a",
        borderRadius: 12,
        padding: "1.5rem",
        marginTop: "1rem",
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "1rem", color: "#94a3b8", letterSpacing: 1 }}>
        AGENT ACTIONS
      </h2>

      <label style={{ fontSize: 12, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>
        to address
      </label>
      <input
        value={toAddress}
        onChange={(e) => setToAddress(e.target.value)}
        style={{
          width: "100%",
          background: "#131a23",
          border: "1px solid #1e2a3a",
          borderRadius: 6,
          color: "#e2e8f0",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          padding: "0.5rem",
          marginBottom: "0.75rem",
          marginTop: 4,
        }}
      />

      <label style={{ fontSize: 12, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>
        amount (wei)
      </label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{
          width: "100%",
          background: "#131a23",
          border: "1px solid #1e2a3a",
          borderRadius: 6,
          color: "#e2e8f0",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          padding: "0.5rem",
          marginBottom: "1rem",
          marginTop: 4,
        }}
      />

      <button
        style={BTN}
        onClick={() => callApi("check-policy", { action: "transfer", amountWei: amount }, "policy")}
        disabled={loading !== null}
      >
        {loading === "check-policy" ? "⟳ checking..." : "① Check TEE policy"}
      </button>

      <button
        style={BTN}
        onClick={() => callApi("get-balance", { address: toAddress }, "balance")}
        disabled={loading !== null}
      >
        {loading === "get-balance" ? "⟳ querying..." : "② Query balance (in TEE)"}
      </button>

      <button
        style={{ ...BTN, borderColor: "#00ff8844", color: "#00ff88" }}
        onClick={() => callApi("transfer", { to: toAddress, amountWei: amount, chainId: 11155111 }, "transfer")}
        disabled={loading !== null}
      >
        {loading === "transfer" ? "⟳ executing..." : "③ Execute transfer"}
      </button>

      <button
        style={{ ...BTN, borderColor: "#a78bfa44", color: "#a78bfa" }}
        onClick={() => callApi("queue", { action: "approve", target: toAddress, amountWei: amount, delaySeconds: 3600 }, "queue")}
        disabled={loading !== null}
      >
        {loading === "queue" ? "⟳ queuing..." : "④ Queue timelocked action (1h)"}
      </button>
    </div>
  );
}
