"use client";
import { useState } from "react";
import AgentPanel from "../components/AgentPanel";
import ActionLog from "../components/ActionLog";
import PolicyBadge from "../components/PolicyBadge";

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "policy" | "transfer" | "balance" | "queue" | "error";
  message: string;
  data?: Record<string, unknown>;
}

export default function Home() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentDid, setAgentDid] = useState<string>("");
  const [policyStatus, setPolicyStatus] = useState<"idle" | "allowed" | "denied">("idle");

  const addLog = (entry: Omit<LogEntry, "id" | "timestamp">) => {
    setLogs((prev) => [
      {
        ...entry,
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080c14",
        fontFamily: "'Space Grotesk', sans-serif",
        color: "#e2e8f0",
        padding: "2rem",
      }}
    >
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #00d4ff44; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#00ff88",
              boxShadow: "0 0 8px #00ff88",
              animation: "pulse 2s infinite",
            }}
          />
          <span style={{ fontSize: 12, color: "#00ff88", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 2 }}>
            T3N TESTNET
          </span>
        </div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          ETH Agent{" "}
          <span style={{ color: "#00d4ff" }}>T3</span>
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
          TEE-verified autonomous Ethereum agents · Terminal 3 ADK
        </p>
      </header>

      {/* DID display */}
      {agentDid && (
        <div
          style={{
            background: "#0d1117",
            border: "1px solid #00d4ff22",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: "#00d4ff",
          }}
        >
          agent: {agentDid}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Left: Agent controls */}
        <div>
          <PolicyBadge status={policyStatus} />
          <AgentPanel
            onLog={addLog}
            onAgentDid={setAgentDid}
            onPolicyStatus={setPolicyStatus}
          />
        </div>

        {/* Right: Action log */}
        <ActionLog logs={logs} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </main>
  );
}
