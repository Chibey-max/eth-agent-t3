wit_bindgen::generate!({
    world: "eth-agent",
    path: "wit",
    additional_derives: [
        serde::Deserialize,
        serde::Serialize,
    ],
    generate_all,
});

mod policy;
mod transfer;
mod balance;
mod queue;

use exports::z::eth_agent::contracts::{GenericInput, Guest};

struct Component;

#[cfg(target_arch = "wasm32")]
impl Guest for Component {
    fn check_policy(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("check-policy: missing input")?;
        policy::check_policy(&input)
    }

    fn execute_transfer(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("execute-transfer: missing input")?;
        // Always verify policy before executing any transfer
        policy::check_policy(&input)?;
        transfer::execute_transfer(&input)
    }

    fn get_balance(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("get-balance: missing input")?;
        balance::get_balance(&input)
    }

    fn queue_action(req: GenericInput) -> Result<Vec<u8>, String> {
        let input = req.input.ok_or("queue-action: missing input")?;
        policy::check_policy(&input)?;
        queue::queue_action(&input)
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);
