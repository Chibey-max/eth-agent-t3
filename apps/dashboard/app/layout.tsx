import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ETH Agent T3 — TEE-verified Ethereum Agents",
  description: "Autonomous Ethereum AI agents with Terminal 3 ADK identity and TEE enforcement",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#080c14" }}>{children}</body>
    </html>
  );
}
