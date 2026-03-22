import dotenv from "dotenv";
import { sepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  toMetaMaskSmartAccount,
  Implementation,
  getSmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit";

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });
dotenv.config({ path: resolve(__dirname, "../.env") });

export const CONFIG = {
  port: parseInt(process.env.PORT || "3001"),
  sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL || "",
  bundlerRpcUrl: process.env.BUNDLER_RPC_URL || "",
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  registryAddress: process.env.CONTRIBUTOR_REGISTRY_ADDRESS as `0x${string}`,
  usdcAddress: (process.env.USDC_ADDRESS ||
    "0x38cFa1c54105d5382e4F3689af819116977A40Ce") as `0x${string}`,
  chain: sepolia,
};

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(CONFIG.sepoliaRpcUrl),
});

export const agentAccount = privateKeyToAccount(CONFIG.agentPrivateKey);

// Smart Accounts Kit environment for Sepolia
export const environment = getSmartAccountsEnvironment(sepolia.id);

// Lazy-init smart account (needs async)
let _smartAccount: Awaited<ReturnType<typeof toMetaMaskSmartAccount>> | null = null;

export async function getAgentSmartAccount() {
  if (_smartAccount) return _smartAccount;

  _smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [agentAccount.address, [], [], []],
    deploySalt: agentAccount.address,
    signer: { account: agentAccount },
  });

  console.log(
    `[Config] Agent smart account: ${_smartAccount.address}`
  );
  return _smartAccount;
}
