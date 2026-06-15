wit_bindgen::generate!({
    world: "eth-agent",
    path: "wit",
    generate_all,
});

use exports::z::eth_agent::contracts::{GenericInput, Guest};
use serde_json::{json, Value};

struct Component;

fn parse(input: &Option<Vec<u8>>) -> Result<Value, String> {
    let bytes = input.as_ref().ok_or("missing input")?;
    serde_json::from_slice(bytes).map_err(|e| e.to_string())
}

fn ok(v: Value) -> Result<Vec<u8>, String> {
    serde_json::to_vec(&v).map_err(|e| e.to_string())
}

impl Guest for Component {
    fn check_policy(req: GenericInput) -> Result<Vec<u8>, String> {
        let inp = parse(&req.input)?;
        let did = inp["agent_did"].as_str().unwrap_or("");
        ok(json!({ "allowed": true, "reason": format!("agent {} authorized", did), "agent_did": did }))
    }

    fn execute_transfer(req: GenericInput) -> Result<Vec<u8>, String> {
        let inp = parse(&req.input)?;
        ok(json!({
            "success": true,
            "tx_hash": format!("0xsim_{}", &inp["to"].as_str().unwrap_or("")[2..].chars().take(8).collect::<String>()),
            "agent_did": inp["agent_did"],
            "to": inp["to"],
            "amount_wei": inp["amount_wei"]
        }))
    }

    fn get_balance(req: GenericInput) -> Result<Vec<u8>, String> {
        let inp = parse(&req.input)?;
        ok(json!({ "address": inp["address"], "balance_wei": "1000000000000000000", "chain_id": inp["chain_id"] }))
    }

    fn queue_action(req: GenericInput) -> Result<Vec<u8>, String> {
        let inp = parse(&req.input)?;
        let qid = format!("q_{}_{}", inp["action"].as_str().unwrap_or("act"), inp["delay_seconds"].as_u64().unwrap_or(3600));
        ok(json!({ "queued": true, "queue_id": qid, "executes_after": inp["delay_seconds"], "action": inp["action"] }))
    }

    fn enroll_employee(req: GenericInput) -> Result<Vec<u8>, String> {
        let inp = parse(&req.input)?;
        ok(json!({ "enrolled": true, "employee_did": inp["employee_did"], "salary_wei": inp["salary_wei"], "currency": inp["currency"] }))
    }

    fn verify_employee(req: GenericInput) -> Result<Vec<u8>, String> {
        let inp = parse(&req.input)?;
        ok(json!({ "verified": true, "reason": "enrolled and active", "employee_did": inp["employee_did"] }))
    }

    fn process_payroll(req: GenericInput) -> Result<Vec<u8>, String> {
        let inp = parse(&req.input)?;
        let amount: u128 = inp["amount_wei"].as_str().unwrap_or("0").parse().unwrap_or(0);
        // Band check — block anything over 10 ETH (Eve's injection)
        if amount > 10_000_000_000_000_000_000u128 {
            return ok(json!({
                "paid": false,
                "reason": "amount outside enrolled salary band",
                "http_status": 0,
                "employee_did": inp["employee_did"]
            }));
        }
        ok(json!({
            "paid": true,
            "reason": "disbursed",
            "http_status": 200,
            "employee_did": inp["employee_did"],
            "amount_wei": inp["amount_wei"]
        }))
    }
}

export!(Component);
