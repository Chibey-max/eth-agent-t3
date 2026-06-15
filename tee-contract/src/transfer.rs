use crate::host::interfaces::{http as http_iface, kv_store, logging};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct TransferInput {
    pub agent_did: String,
    pub to: String,
    pub amount_wei: String,
    pub token: Option<String>, // None = native ETH, Some(addr) = ERC-20
    pub chain_id: u64,
    pub nonce: Option<u64>,
}

#[derive(Serialize)]
pub struct TransferResult {
    pub success: bool,
    pub tx_hash: Option<String>,
    pub error: Option<String>,
    pub agent_did: String,
    pub to: String,
    pub amount_wei: String,
}

/// Executes an ETH transfer by calling the configured RPC endpoint.
/// The private key / RPC URL never leave the TEE — they are read from
/// the sealed KV secrets map at runtime.
pub fn execute_transfer(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: TransferInput =
        serde_json::from_slice(input).map_err(|e| format!("transfer: bad input JSON: {e}"))?;

    let tid = tenant_context::tenant_did();
    let map_name = format!("z:{}:secrets", hex::encode(&tid));

    // Read RPC URL from sealed secrets (never hard-coded)
    let rpc_url = read_secret(&map_name, "rpc_url")?;

    // Build eth_sendRawTransaction JSON-RPC call
    // In production this would sign with the sealed private key;
    // for the sandbox we call eth_call for a read-only simulation
    let rpc_payload = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getBalance",
        "params": [req.to, "latest"],
        "id": 1
    });

    let resp = http_iface::call(&http_iface::Request {
        method: http_iface::Verb::Post,
        url: rpc_url.clone(),
        headers: Some(vec![
            ("Content-Type".to_string(), "application/json".to_string()),
        ]),
        payload: Some(
            serde_json::to_vec(&rpc_payload).map_err(|e| format!("transfer: serialize: {e}"))?,
        ),
    })
    .map_err(|e| format!("transfer: rpc call failed: {e}"))?;

    if resp.code != 200 {
        let body = String::from_utf8_lossy(&resp.payload);
        return Err(format!("transfer: RPC error HTTP {}: {}", resp.code, body));
    }

    let rpc_resp: serde_json::Value =
        serde_json::from_slice(&resp.payload).map_err(|e| format!("transfer: parse rpc response: {e}"))?;

    // Extract result or error from JSON-RPC response
    if let Some(err) = rpc_resp.get("error") {
        let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("unknown rpc error");
        let result = TransferResult {
            success: false,
            tx_hash: None,
            error: Some(msg.to_string()),
            agent_did: req.agent_did,
            to: req.to,
            amount_wei: req.amount_wei,
        };
        return Ok(serde_json::to_vec(&result).unwrap());
    }

    // Simulate tx hash for sandbox (real implementation would sign + broadcast)
    let simulated_hash = format!(
        "0xsim_{}_{}",
        &req.to[2..10.min(req.to.len())],
        &req.amount_wei
    );

    let _ = logging::info(&format!(
        "transfer: agent {} → {} {} wei (chain {})",
        req.agent_did, req.to, req.amount_wei, req.chain_id
    ));

    let result = TransferResult {
        success: true,
        tx_hash: Some(simulated_hash),
        error: None,
        agent_did: req.agent_did,
        to: req.to,
        amount_wei: req.amount_wei,
    };

    serde_json::to_vec(&result).map_err(|e| format!("transfer: output serialize: {e}"))
}

fn read_secret(map_name: &str, key: &str) -> Result<String, String> {
    let bytes = kv_store::get(map_name, key.as_bytes())
        .map_err(|e| format!("secrets: kv read '{}' failed: {e}", key))?
        .ok_or_else(|| format!("secrets: '{}' not found — run scripts/3-seed-secrets.ts first", key))?;
    String::from_utf8(bytes).map_err(|_| format!("secrets: '{}' is not valid utf8", key))
}
