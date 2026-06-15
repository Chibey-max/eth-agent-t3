use crate::host::interfaces::{http as http_iface, kv_store, logging};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct BalanceInput {
    pub address: String,
    pub token: Option<String>, // None = native ETH
    pub chain_id: u64,
}

#[derive(Serialize)]
pub struct BalanceResult {
    pub address: String,
    pub balance_wei: String,
    pub token: Option<String>,
    pub chain_id: u64,
}

pub fn get_balance(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: BalanceInput =
        serde_json::from_slice(input).map_err(|e| format!("balance: bad input JSON: {e}"))?;

    let tid = tenant_context::tenant_did();
    let map_name = format!("z:{}:secrets", hex::encode(&tid));

    let rpc_url = {
        let bytes = kv_store::get(&map_name, b"rpc_url")
            .map_err(|e| format!("balance: kv read: {e}"))?
            .ok_or("balance: rpc_url not in secrets — run scripts/3-seed-secrets.ts")?;
        String::from_utf8(bytes).map_err(|_| "balance: rpc_url not valid utf8")?
    };

    let payload = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getBalance",
        "params": [req.address, "latest"],
        "id": 1
    });

    let resp = http_iface::call(&http_iface::Request {
        method: http_iface::Verb::Post,
        url: rpc_url,
        headers: Some(vec![
            ("Content-Type".to_string(), "application/json".to_string()),
        ]),
        payload: Some(serde_json::to_vec(&payload).map_err(|e| format!("balance: serialize: {e}"))?),
    })
    .map_err(|e| format!("balance: rpc call: {e}"))?;

    if resp.code != 200 {
        return Err(format!("balance: RPC HTTP {}", resp.code));
    }

    let rpc_resp: serde_json::Value =
        serde_json::from_slice(&resp.payload).map_err(|e| format!("balance: parse: {e}"))?;

    let balance_hex = rpc_resp["result"]
        .as_str()
        .unwrap_or("0x0")
        .to_string();

    // Convert hex to decimal string
    let balance_dec = u128::from_str_radix(balance_hex.trim_start_matches("0x"), 16)
        .unwrap_or(0)
        .to_string();

    let _ = logging::info(&format!("balance: {} = {} wei", req.address, balance_dec));

    let result = BalanceResult {
        address: req.address,
        balance_wei: balance_dec,
        token: req.token,
        chain_id: req.chain_id,
    };

    serde_json::to_vec(&result).map_err(|e| format!("balance: output: {e}"))
}
