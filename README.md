# ETH Agent T3

**Autonomous Ethereum AI agents with TEE-verified identity via Terminal 3 ADK.**

Built for the [Terminal 3 Agent Dev Kit Bounty Challenge](https://dorahacks.io/hackathon/t3adkdevchallenge/detail).

## Architecture

```
User/Guardian
    │
    ▼
AgentWallet.sol ◄──── on-chain policy (spending cap, selector whitelist, timelock)
    │
    ▼
T3N TEE Enclave ◄──── did:t3n identity verified here
    │   ├── check-policy   (whitelist + cap check inside enclave)
    │   ├── execute-transfer (RPC URL sealed in KV secrets)
    │   ├── get-balance    (read-only RPC call)
    │   └── queue-action   (timelock stored in TEE KV)
    │
    ▼
Ethereum (Sepolia / Mantle)
```

**Two layers of trust:**
1. **T3N TEE** — agent identity verified via `did:t3n` DID, policy checked inside the enclave, RPC credentials never leave the TEE
2. **AgentWallet.sol** — on-chain enforcement of spending caps, selector whitelisting, daily limits, and timelocked queues

## Quickstart

### Prerequisites
- Node ≥ 18
- Rust + `wasm32-wasip2` target
- Foundry

### 1. Clone and install

```bash
git clone https://github.com/Chibey-max/eth-agent-t3
cd eth-agent-t3
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in:
#   T3N_API_KEY      — from terminal3.io/products/agent-developer-kit
#   T3N_DID          — did:t3n:6263160378e6099a7c48b714ecdc9e5752fba04a
#   AGENT_PRIVATE_KEY — fresh ETH key for the agent
#   SEPOLIA_RPC_URL  — your Alchemy/Infura Sepolia endpoint
```

### 3. Build the TEE contract (Rust → WASM)

```bash
cd tee-contract
rustup target add wasm32-wasip2
cargo build --target wasm32-wasip2 --release
cd ..
```

### 4. Run setup scripts in order

```bash
# Verify T3N connection
ts-node scripts/1-verify-connection.ts

# Register WASM on T3N testnet
ts-node scripts/2-register-contract.ts

# Seal secrets into TEE (RPC URL, whitelist, spending cap)
ts-node scripts/3-seed-secrets.ts

# End-to-end demo: policy → balance → transfer → queue
ts-node scripts/4-invoke-agent.ts
```

### 5. Deploy the smart contract

```bash
forge install OpenZeppelin/openzeppelin-contracts
forge build
forge script contracts/script/Deploy.s.sol --rpc-url sepolia --broadcast
```

### 6. Run the dashboard

```bash
cd apps/dashboard
npm run dev
# Open http://localhost:3000
```

## Project Structure

```
eth-agent-t3/
├── tee-contract/          # Rust → WASM TEE contract
│   ├── src/
│   │   ├── lib.rs         # wit-bindgen entry + dispatch
│   │   ├── policy.rs      # agent whitelist + spending cap (in TEE)
│   │   ├── transfer.rs    # ETH transfer via sealed RPC
│   │   ├── balance.rs     # balance query
│   │   └── queue.rs       # timelocked action queue
│   └── wit/world.wit      # exports: check-policy, execute-transfer, get-balance, queue-action
│
├── packages/eth-agent-kit/ # TypeScript SDK
│   └── src/
│       ├── t3/client.ts   # T3nClient setup + handshake
│       ├── t3/register.ts # WASM registration
│       ├── t3/secrets.ts  # KV map creation + secret seeding
│       ├── t3/invoke.ts   # agent session + contract calls
│       └── agent/wallet.ts # AgentWallet.sol viem interface
│
├── contracts/
│   └── src/AgentWallet.sol # Guardian/agent roles, policy engine, timelock
│
├── apps/dashboard/         # Next.js cyberpunk UI
│   ├── app/page.tsx
│   ├── components/
│   │   ├── AgentPanel.tsx  # Action buttons
│   │   ├── ActionLog.tsx   # TEE audit trail
│   │   └── PolicyBadge.tsx # TEE policy status
│   └── app/api/agent/[action]/route.ts
│
└── scripts/
    ├── 1-verify-connection.ts
    ├── 2-register-contract.ts
    ├── 3-seed-secrets.ts
    └── 4-invoke-agent.ts
```

## What the TEE enforces

| Check | Where |
|-------|-------|
| Agent DID is whitelisted | `policy.rs` in TEE enclave |
| Amount ≤ spending cap | `policy.rs` in TEE enclave |
| RPC URL stays secret | Sealed in `z:<tid>:secrets` KV |
| Actions logged | TEE audit ledger via `logging::info` |
| Selector whitelist | `AgentWallet.sol` on-chain |
| Timelock delay | Both `queue.rs` (TEE) and `AgentWallet.sol` |

## Technologies

- **Terminal 3 ADK** — `@terminal3/t3n-sdk`, TEE contracts, `did:t3n` identity
- **Rust + WASM** — `wasm32-wasip2`, `wit-bindgen`, `serde_json`
- **TypeScript** — T3N SDK integration, monorepo with Turborepo
- **Solidity** — `AgentWallet.sol` with ReentrancyGuard, Foundry
- **Next.js 14** — dashboard with Space Grotesk + JetBrains Mono cyberpunk UI
- **viem** — Ethereum client

## License

MIT
