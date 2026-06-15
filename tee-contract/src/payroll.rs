use crate::host::interfaces::{
    http_with_placeholders as hp, kv_store, logging, time,
};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};

// ── enroll-employee ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct EnrollInput {
    pub employee_did: String,
    pub salary_wei: String,      // monthly salary in wei (or stablecoin base units)
    pub currency: String,        // "USDC" | "ETH"
    pub band_min_wei: String,    // lower bound of allowed salary band
    pub band_max_wei: String,    // upper bound — guards against tampering
}

#[derive(Serialize)]
struct EnrollResult {
    enrolled: bool,
    employee_did: String,
    salary_wei: String,
    currency: String,
}

/// Stores a salary policy for an employee.
/// Note: bank details are NOT stored here. They live in the employee's
/// encrypted user profile and are only ever substituted by the host
/// at disbursement time via http-with-placeholders.
pub fn enroll_employee(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: EnrollInput =
        serde_json::from_slice(input).map_err(|e| format!("enroll: bad JSON: {e}"))?;

    let tid = tenant_context::tenant_did();
    let map = format!("z:{}:payroll", hex::encode(&tid));

    let policy = serde_json::json!({
        "employee_did": req.employee_did,
        "salary_wei": req.salary_wei,
        "currency": req.currency,
        "band_min_wei": req.band_min_wei,
        "band_max_wei": req.band_max_wei,
        "enrolled_at": time::now_unix_seconds(),
        "status": "active",
    });

    kv_store::set(
        &map,
        req.employee_did.as_bytes(),
        &serde_json::to_vec(&policy).map_err(|e| format!("enroll: serialize: {e}"))?,
    )
    .map_err(|e| format!("enroll: kv write: {e}"))?;

    let _ = logging::info(&format!(
        "payroll: enrolled {} at {} {}",
        req.employee_did, req.salary_wei, req.currency
    ));

    let out = EnrollResult {
        enrolled: true,
        employee_did: req.employee_did,
        salary_wei: req.salary_wei,
        currency: req.currency,
    };
    serde_json::to_vec(&out).map_err(|e| format!("enroll: out: {e}"))
}

// ── verify-employee ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct VerifyInput {
    pub employee_did: String,
}

#[derive(Serialize)]
struct VerifyResult {
    verified: bool,
    reason: String,
    salary_wei: Option<String>,
    currency: Option<String>,
}

pub fn verify_employee(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: VerifyInput =
        serde_json::from_slice(input).map_err(|e| format!("verify: bad JSON: {e}"))?;

    let tid = tenant_context::tenant_did();
    let map = format!("z:{}:payroll", hex::encode(&tid));

    let stored = kv_store::get(&map, req.employee_did.as_bytes())
        .map_err(|e| format!("verify: kv read: {e}"))?;

    let out = match stored {
        None => VerifyResult {
            verified: false,
            reason: format!("{} is not enrolled", req.employee_did),
            salary_wei: None,
            currency: None,
        },
        Some(bytes) => {
            let policy: serde_json::Value =
                serde_json::from_slice(&bytes).map_err(|e| format!("verify: parse: {e}"))?;
            let active = policy["status"].as_str() == Some("active");
            VerifyResult {
                verified: active,
                reason: if active { "enrolled and active".into() } else { "enrollment inactive".into() },
                salary_wei: policy["salary_wei"].as_str().map(|s| s.to_string()),
                currency: policy["currency"].as_str().map(|s| s.to_string()),
            }
        }
    };

    serde_json::to_vec(&out).map_err(|e| format!("verify: out: {e}"))
}

// ── process-payroll ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct PayrollInput {
    pub employee_did: String,
    pub amount_wei: String,           // amount the agent proposes to pay
    pub disburse_url: String,         // payout API endpoint (allowlisted host)
    pub idempotency_key: String,      // prevents double-payment on replay
}

#[derive(Serialize)]
struct PayrollResult {
    paid: bool,
    employee_did: String,
    amount_wei: String,
    http_status: u16,
    idempotency_key: String,
    reason: String,
}

/// Disburses one employee's pay.
///
/// The critical property: the request body contains `{{profile.bank_account}}`
/// and `{{profile.routing}}` placeholders. The host resolves these from the
/// employee's encrypted profile INSIDE the enclave, immediately before the
/// outbound call. The plaintext bank details never enter WASM memory, never
/// reach the agent, and never appear in any log line.
///
/// Before paying, the proposed amount is validated against the salary band
/// stored at enrollment, so a compromised agent cannot inflate a payment.
pub fn process_payroll(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: PayrollInput =
        serde_json::from_slice(input).map_err(|e| format!("payroll: bad JSON: {e}"))?;

    let tid = tenant_context::tenant_did();
    let map = format!("z:{}:payroll", hex::encode(&tid));

    // 1. Look up the employee's salary band
    let stored = kv_store::get(&map, req.employee_did.as_bytes())
        .map_err(|e| format!("payroll: kv read: {e}"))?
        .ok_or_else(|| format!("payroll: {} not enrolled", req.employee_did))?;

    let policy: serde_json::Value =
        serde_json::from_slice(&stored).map_err(|e| format!("payroll: parse policy: {e}"))?;

    // 2. Validate proposed amount is inside the enrolled band (anti-tamper)
    let amount: u128 = req.amount_wei.parse().map_err(|_| "payroll: bad amount".to_string())?;
    let band_min: u128 = policy["band_min_wei"].as_str().unwrap_or("0").parse().unwrap_or(0);
    let band_max: u128 = policy["band_max_wei"].as_str().unwrap_or("0").parse().unwrap_or(u128::MAX);

    if amount < band_min || amount > band_max {
        let _ = logging::error(&format!(
            "payroll: BLOCKED {} amount {} outside band [{}, {}]",
            req.employee_did, amount, band_min, band_max
        ));
        let out = PayrollResult {
            paid: false,
            employee_did: req.employee_did,
            amount_wei: req.amount_wei,
            http_status: 0,
            idempotency_key: req.idempotency_key,
            reason: format!("amount outside enrolled salary band [{}, {}]", band_min, band_max),
        };
        return Ok(serde_json::to_vec(&out).unwrap());
    }

    // 3. Build the disbursement request with PII placeholders.
    //    The host substitutes these from the employee profile in-enclave.
    let body = serde_json::json!({
        "amount_wei": req.amount_wei,
        "currency": policy["currency"],
        "destination": {
            "account": "{{profile.bank_account}}",
            "routing":  "{{profile.routing}}",
            "holder":   "{{profile.full_name}}"
        },
        "idempotency_key": req.idempotency_key
    });

    let resp = hp::call(&hp::Request {
        method: hp::Verb::Post,
        url: req.disburse_url.clone(),
        headers: Some(vec![
            ("Content-Type".to_string(), "application/json".to_string()),
            ("Idempotency-Key".to_string(), req.idempotency_key.clone()),
        ]),
        // fields the host is allowed to substitute (must match placeholder_allowlist)
        placeholders: vec![
            "profile.bank_account".to_string(),
            "profile.routing".to_string(),
            "profile.full_name".to_string(),
        ],
        payload: Some(serde_json::to_vec(&body).map_err(|e| format!("payroll: body: {e}"))?),
    })
    .map_err(|e| format!("payroll: disburse call failed: {e}"))?;

    let paid = resp.code >= 200 && resp.code < 300;

    // 4. Audit — note we log the DID and amount, NEVER the bank details
    let _ = logging::info(&format!(
        "payroll: {} {} for {} -> HTTP {}",
        if paid { "PAID" } else { "FAILED" },
        req.amount_wei,
        req.employee_did,
        resp.code
    ));

    let out = PayrollResult {
        paid,
        employee_did: req.employee_did,
        amount_wei: req.amount_wei,
        http_status: resp.code,
        idempotency_key: req.idempotency_key,
        reason: if paid { "disbursed".into() } else { format!("payout API returned {}", resp.code) },
    };
    serde_json::to_vec(&out).map_err(|e| format!("payroll: out: {e}"))
}
