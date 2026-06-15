"use client";

const STATUS = {
  idle: { color: "#475569", label: "AWAITING POLICY CHECK", bg: "#0d1117" },
  allowed: { color: "#00ff88", label: "✓ AGENT AUTHORIZED BY TEE", bg: "#00ff8811" },
  denied: { color: "#ef4444", label: "✗ AGENT DENIED BY TEE POLICY", bg: "#ef444411" },
};

export default function PolicyBadge({ status }: { status: "idle" | "allowed" | "denied" }) {
  const s = STATUS[status];
  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.color}44`,
        borderRadius: 8,
        padding: "0.6rem 1rem",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        color: s.color,
        letterSpacing: 1,
      }}
    >
      {s.label}
    </div>
  );
}
