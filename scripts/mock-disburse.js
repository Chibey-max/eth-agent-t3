/**
 * Mock disbursement endpoint for local demos.
 *
 * Stands in for the real payout rail so `scripts/5-run-payroll.ts` and the
 * dashboard can run end-to-end on a laptop. It deliberately asserts that the
 * destination it received contains REAL substituted values (not the raw
 * {{profile.*}} placeholders) — proving the host did the substitution. It logs
 * only a masked view, mirroring how a real rail should treat PII.
 *
 * Run:  node scripts/mock-disburse.js   (listens on :8787)
 */
const http = require("http");

const PORT = process.env.MOCK_PORT || 8787;

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || !req.url.endsWith("/disburse")) {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const p = JSON.parse(body || "{}");
      const acct = p?.destination?.account ?? "";

      // If we still see a placeholder, substitution did NOT happen — reject.
      if (typeof acct === "string" && acct.includes("{{")) {
        res.writeHead(422, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "placeholder not substituted — PII path broken" }));
        return;
      }

      const masked = acct ? `****${String(acct).slice(-4)}` : "(none)";
      console.log(
        `[disburse] ${p.amount_wei} ${p.currency || ""} -> acct ${masked} ` +
          `key=${p.idempotency_key}`
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "settled", masked_account: masked }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
  });
});

server.listen(PORT, () => console.log(`mock disburse rail on http://localhost:${PORT}/disburse`));
