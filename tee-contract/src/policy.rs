use crate::host::interfaces::{kv_store, logging};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
pub struct PolicyInput {
    pub agent_did: String,
    pub action: String,
    pub token: Option<String>,
    pub amount_wei: Option<String>,
    pub to: Option<String>,
}

#[derive(Serialize)]
pub struct PolicyResult {
    pub allowed: bool,
    pub reason: String,
    pub agent_did: String,
}

/// Reads the agent whitelist from the secrets KV map and validates
/// that the calling agent is permitted to perform the requested action.
/// All validation happens inside the TEE enclave.
pub fn check_policy(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: PolicyInput =
        serde_json::from_slice(input).map_err(|e| format!("policy: bad input JSON: {e}"))?;

    let tid = tenant_context::tenant_did();
    let map_name = format!("z:{}:secrets", hex::encode(&tid));

    // Read whitelist from sealed KV store
    let whitelist_bytes = kv_store::get(&map_name, b"agent_whitelist")
        .map_err(|e| format!("policy: kv read error: {e}"))?;

    let allowed = if let Some(bytes) = whitelist_bytes {
        let whitelist: Vec<String> =
            serde_json::from_slice(&bytes).map_err(|e| format!("policy: bad whitelist JSON: {e}"))?;
        whitelist.contains(&req.agent_did)
    } else {
        // No whitelist set — deny all by default (secure default)
        false
    };

    // Validate amount against per-action spending cap
    if allowed {
        if let Some(amount_str) = &req.amount_wei {
            let amount: u128 = amount_str
                .parse()
                .map_err(|_| "policy: invalid amount_wei format".to_string())?;

            let cap_bytes = kv_store::get(&map_name, b"spending_cap_wei")
                .map_err(|e| format!("policy: kv cap read: {e}"))?;

            if let Some(cap_raw) = cap_bytes {
                let cap_str = String::from_utf8(cap_raw)
                    .map_err(|_| "policy: cap not valid utf8".to_string())?;
                let cap: u128 = cap_str
                    .trim()
                    .parse()
                    .map_err(|_| "policy: invalid cap format".to_string())?;

                if amount > cap {
                    let _ = logging::warn(&format!(
                        "policy: agent {} exceeded cap: {} > {}",
                        req.agent_did, amount, cap
                    ));
                    let result = PolicyResult {
                        allowed: false,
                        reason: format!("amount {} exceeds spending cap {}", amount, cap),
                        agent_did: req.agent_did,
                    };
                    return Ok(serde_json::to_vec(&result).unwrap());
                }
            }
        }
    }

    let reason = if allowed {
        format!("agent {} authorized for action: {}", req.agent_did, req.action)
    } else {
        format!("agent {} is not whitelisted", req.agent_did)
    };

    let _ = logging::info(&reason);

    let result = PolicyResult {
        allowed,
        reason,
        agent_did: req.agent_did,
    };

    serde_json::to_vec(&result).map_err(|e| format!("policy: serialize error: {e}"))
}
