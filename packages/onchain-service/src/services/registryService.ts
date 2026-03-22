import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CONFIG, publicClient } from "../config.js";
import { CONTRIBUTOR_REGISTRY_ABI } from "../abis/ContributorRegistry.js";

const agentAccount = privateKeyToAccount(CONFIG.agentPrivateKey);

const walletClient = createWalletClient({
  account: agentAccount,
  chain: CONFIG.chain,
  transport: http(CONFIG.sepoliaRpcUrl),
});

export async function getWalletForHandle(
  githubHandle: string
): Promise<string> {
  const wallet = await publicClient.readContract({
    address: CONFIG.registryAddress,
    abi: CONTRIBUTOR_REGISTRY_ABI,
    functionName: "getWalletForHandle",
    args: [githubHandle],
  });
  return wallet as string;
}

export async function getReputation(contributorAddress: `0x${string}`) {
  const result = await publicClient.readContract({
    address: CONFIG.registryAddress,
    abi: CONTRIBUTOR_REGISTRY_ABI,
    functionName: "getReputation",
    args: [contributorAddress],
  });
  const [totalEarned, totalPayouts, reputationScore, lastPaidAt] =
    result as unknown as bigint[];
  return { totalEarned, totalPayouts, reputationScore, lastPaidAt };
}

export async function logPayout(
  contributor: `0x${string}`,
  amountUsdc: number,
  aiScore: number,
  txHash: `0x${string}`
) {
  const hash = await walletClient.writeContract({
    address: CONFIG.registryAddress,
    abi: CONTRIBUTOR_REGISTRY_ABI,
    functionName: "logPayout",
    args: [
      contributor,
      parseUnits(amountUsdc.toString(), 6),
      BigInt(Math.round(aiScore * 100)),
      txHash as `0x${string}`,
    ],
  });
  return hash;
}
