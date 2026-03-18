"use client";

import { useState, useCallback } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import {
  toMetaMaskSmartAccount,
  Implementation,
} from "@metamask/smart-accounts-kit";

export interface SmartAccountInfo {
  address: `0x${string}`;
  isDeployed: boolean;
}

const STORAGE_KEY = "brahma_smart_account_v1";

export function useSmartAccount() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [smartAccountInfo, setSmartAccountInfo] =
    useState<SmartAccountInfo | null>(() => {
      if (typeof window === "undefined") return null;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSmartAccount = useCallback(async () => {
    if (!address || !walletClient || !publicClient) return null;
    setCreating(true);
    setError(null);

    try {
      // Create a Hybrid smart account — user's EOA is the owner
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [address, [], [], []],
        deploySalt: "0x",
        signer: { walletClient },
      });

      // Check if it's already deployed on-chain
      const code = await publicClient.getCode({
        address: smartAccount.address,
      });
      const isDeployed = !!code && code !== "0x";

      const info: SmartAccountInfo = {
        address: smartAccount.address,
        isDeployed,
      };

      setSmartAccountInfo(info);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info));

      return smartAccount;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create smart account");
      return null;
    } finally {
      setCreating(false);
    }
  }, [address, walletClient, publicClient]);

  const reset = useCallback(() => {
    setSmartAccountInfo(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    smartAccountInfo,
    creating,
    error,
    createSmartAccount,
    reset,
    isConnected,
  };
}