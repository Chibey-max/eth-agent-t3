"use client";
import type { LogEntry } from "../app/page";

const TYPE_COLOR: Record<LogEntry["type"], string> = {
  policy: "#00d4ff",
  transfer: "#00ff88",
  balance: "#a78bfa",
  queue: "#f59e0b",
  error: "#ef4444",
};

const TYPE_LABEL: Record<LogEntry["type"], string> = {
  policy: "POLICY",
  transfer: "TRANSFER",
  balance: "BALANCE",
  queue: "QUEUE",
  error: "ERROR",
};

export default function ActionLog({ logs }: { logs: LogEntry[] }) {
  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #1e2a3a",
        borderRadius: 12,
        padding: "1.5rem",
        height: "calc(100vh - 200px)",
        overflowY: "auto",
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "1rem", color: "#94a3b8", letterSpacing: 1 }}>
        ACTION LOG · TEE AUDIT TRAIL
      </h2>

      {logs.length === 0 && (
        <p style={{ color: "#334155", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
          // no actions yet — run an agent operation
        </p>
      )}

      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            borderLeft: `2px solid ${TYPE_COLOR[log.type]}`,
            paddingLeft: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: TYPE_COLOR[log.type],
                letterSpacing: 1,
              }}
            >
              {TYPE_LABEL[log.type]}
            </span>
            <span style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 4 }}>{log.message}</p>
          {log.data && (
            <pre
              style={{
                fontSize: 11,
                color: "#475569",
                fontFamily: "'JetBrains Mono', monospace",
                background: "#0a0e16",
                borderRadius: 4,
                padding: "0.5rem",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {JSON.stringify(log.data, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
