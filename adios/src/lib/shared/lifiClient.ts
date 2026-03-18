import { createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base, arbitrum, optimism, polygon } from "viem/chains";
import { createConfig, EVM } from "@lifi/sdk";
import { YIELD_CHAINS } from "./config";

const ALCHEMY_KEY = process.env.ALCHEMY_KEY;
if (!ALCHEMY_KEY) throw new Error("Missing env var: ALCHEMY_KEY");

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
};

const PUBLIC_RPC: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  8453: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  137: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
};

// Track both key and source chain — re-init if either changes
let configuredKey: string | null = null;
let configuredChainId: number | null = null;

export function initLiFi(privateKey: string, sourceChainId: number) {
  const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  if (configuredKey === normalizedKey && configuredChainId === sourceChainId) return;

  const account = privateKeyToAccount(normalizedKey as `0x${string}`);
  const sourceChain = CHAIN_MAP[sourceChainId];
  if (!sourceChain) throw new Error(`initLiFi: unsupported source chain ${sourceChainId}`);

  const sourceRpc = PUBLIC_RPC[sourceChainId] ?? "https://mainnet.base.org";

  createConfig({
    integrator: process.env.LIFI_INTEGRATOR || "brahma",
    providers: [
      EVM({
        getWalletClient: async () =>
          createWalletClient({
            account,
            chain: sourceChain,
            transport: http(sourceRpc),
          }),
        switchChain: async (targetChainId: number) => {
          const targetChain = CHAIN_MAP[targetChainId];
          if (!targetChain) throw new Error(`LI.FI switchChain: unsupported chain ${targetChainId}`);
          const rpc = PUBLIC_RPC[targetChainId] ?? "https://mainnet.base.org";
          return createWalletClient({
            account,
            chain: targetChain,
            transport: http(rpc),
          });
        },
      }),
    ],
  });

  configuredKey = normalizedKey;
  configuredChainId = sourceChainId;
}