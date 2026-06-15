# Architecture

## Trust Stack

\`\`\`
T3N TEE (did:t3n identity + policy enclave)
  └── AgentWallet.sol (on-chain spending cap + selector whitelist)
        └── Ethereum target (Sepolia / Mantle)
\`\`\`

## Data Flow
1. Agent authenticates → gets did:t3n DID from T3N
2. TEE contract checks DID against sealed whitelist
3. TEE reads RPC URL from sealed KV secrets
4. On-chain AgentWallet enforces second policy layer
5. Action logged to T3N audit ledger
