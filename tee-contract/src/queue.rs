use crate::host::interfaces::{kv_store, logging};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct QueueInput {
    pub agent_did: String,
    pub action: String,       // "transfer" | "approve" | "call"
    pub target: String,       // contract or address
    pub calldata: Option<String>, // hex-encoded calldata for contract calls
    pub amount_wei: Option<String>,
    pub delay_seconds: u64,   // timelock delay
}

#[derive(Serialize)]
pub struct QueueResult {
    pub queued: bool,
    pub queue_id: String,
    pub executes_after: u64, // unix timestamp
    pub action: String,
    pub agent_did: String,
}

/// Queues a timelocked action into the TEE KV store.
/// Mirrors the AgentWallet.sol timelock queue but enforced inside the enclave.
pub fn queue_action(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: QueueInput =
        serde_json::from_slice(input).map_err(|e| format!("queue: bad input JSON: {e}"))?;

    let tid = tenant_context::tenant_did();
    let map_name = format!("z:{}:queue", hex::encode(&tid));

    // Build a deterministic queue entry ID
    let queue_id = format!(
        "q_{}_{}",
        &req.agent_did[req.agent_did.len().saturating_sub(8)..],
        req.delay_seconds
    );

    // Simulate timestamp (TEE doesn't have system clock; use a relative marker)
    let executes_after = req.delay_seconds; // relative to now

    let entry = serde_json::json!({
        "queue_id": queue_id,
        "agent_did": req.agent_did,
        "action": req.action,
        "target": req.target,
        "calldata": req.calldata,
        "amount_wei": req.amount_wei,
        "delay_seconds": req.delay_seconds,
        "executes_after": executes_after,
        "status": "pending"
    });

    kv_store::set(
        &map_name,
        queue_id.as_bytes(),
        &serde_json::to_vec(&entry).map_err(|e| format!("queue: serialize entry: {e}"))?,
    )
    .map_err(|e| format!("queue: kv write: {e}"))?;

    let _ = logging::info(&format!(
        "queue: agent {} queued {} → {} (delay {}s)",
        req.agent_did, req.action, req.target, req.delay_seconds
    ));

    let result = QueueResult {
        queued: true,
        queue_id,
        executes_after,
        action: req.action,
        agent_did: req.agent_did,
    };

    serde_json::to_vec(&result).map_err(|e| format!("queue: output: {e}"))
}
