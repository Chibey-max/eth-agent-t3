# TEE Contract

Rust → WASM contract running inside Terminal 3 Network TEE.

## Functions
- `check-policy` — validates agent DID against whitelist + spending cap
- `execute-transfer` — ETH transfer via sealed RPC credentials
- `get-balance` — read on-chain balance
- `queue-action` — timelock action in TEE KV store

## Build
\`\`\`bash
cargo build --target wasm32-wasip2 --release
\`\`\`
