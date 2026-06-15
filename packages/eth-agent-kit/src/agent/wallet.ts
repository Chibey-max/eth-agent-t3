import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const AGENT_WALLET_ABI = parseAbi([
  "function executeAction(address target, bytes calldata data, uint256 value) external",
  "function isWhitelisted(address agent) external view returns (bool)",
  "function getPolicy(address agent) external view returns (uint256 spendingCap, bool active)",
  "function queueAction(address target, bytes calldata data, uint256 value) external returns (bytes32)",
  "event ActionExecuted(address indexed agent, address indexed target, uint256 value, bytes32 txHash)",
]);

export function createAgentWalletClient(contractAddress: `0x${string}`) {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error("AGENT_PRIVATE_KEY not set");

  const account = privateKeyToAccount(privateKey);
  const rpcUrl = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  return {
    async isWhitelisted(agentAddress: `0x${string}`): Promise<boolean> {
      return publicClient.readContract({
        address: contractAddress,
        abi: AGENT_WALLET_ABI,
        functionName: "isWhitelisted",
        args: [agentAddress],
      }) as Promise<boolean>;
    },

    async executeAction(
      target: `0x${string}`,
      data: `0x${string}`,
      value: bigint
    ): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: contractAddress,
        abi: AGENT_WALLET_ABI,
        functionName: "executeAction",
        args: [target, data, value],
      });
    },

    async queueAction(
      target: `0x${string}`,
      data: `0x${string}`,
      value: bigint
    ): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: contractAddress,
        abi: AGENT_WALLET_ABI,
        functionName: "queueAction",
        args: [target, data, value],
      });
    },
  };
}
