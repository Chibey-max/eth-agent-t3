# eth-agent-kit

TypeScript SDK integrating Terminal 3 ADK with Ethereum AgentWallet.

## Usage
\`\`\`ts
import { createT3Session, createAgentSession, executeTransfer } from 'eth-agent-kit'
const session = await createT3Session()
const agent = await createAgentSession(session.tenantDid)
const result = await executeTransfer(agent, { to: '0x...', amountWei: '1000', chainId: 11155111 })
\`\`\`
