"use client";

import { useState, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { createWalletClient, custom, parseUnits } from "viem";

declare global {
    interface Window {
        ethereum?: any;
    }
}

const STORAGE_KEY = "brahma_permission_v1";

export interface StoredPermission {
    context: string;
    delegationManager: string;
    chainId: number;
    userAddress: string;
}

function isValidAddress(addr: string): addr is `0x${string}` {
    return typeof addr === "string" && addr.startsWith("0x") && addr.length === 42;
}

export function useDelegation(agentAddress: string) {
    const { address } = useAccount();
    const chainId = useChainId();

    const [permission, setPermission] = useState<StoredPermission | null>(() => {
        if (typeof window === "undefined") return null;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    });

    const [signing, setSigning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createAndSign = useCallback(async () => {
        // Validate wallet connection
        if (!address) {
            setError("Connect your wallet first");
            return;
        }

        // Validate agent address — catches empty string, undefined, short addresses
        if (!isValidAddress(agentAddress)) {
            setError("Start the yield agent first — agent wallet address not ready");
            return;
        }

        setSigning(true);
        setError(null);

        try {
            if (!window.ethereum) {
                throw new Error("MetaMask Flask not found — install it at metamask.io/flask");
            }

            const client7715 = createWalletClient({
                transport: custom(window.ethereum),
            }).extend(erc7715ProviderActions());

            const currentChainId = chainId ?? 8453;

            const grantedPermissions = await client7715.requestExecutionPermissions([{
                chainId: currentChainId,
                expiry: Math.floor(Date.now() / 1000) + 604800, // 1 week
                isAdjustmentAllowed: true,
                signer: {
                    type: "account",
                    data: {
                        address: agentAddress, // already validated as 0x${string}
                    },
                },
                permission: {
                    type: "erc20-token-periodic",
                    data: {
                        tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC Base
                        periodAmount: parseUnits("1000", 6), // 1000 USDC/day max
                        periodDuration: 86400,
                        justification:
                            "Brahma autonomous yield agent — deposits to highest APY Aave V3 pool. " +
                            "Protected by on-chain YieldCaveatEnforcer (0xf042...). Only Aave V3 + LI.FI allowed.",
                    },
                },
            } as any]);

            // Cast to any — signerMeta exists at runtime but missing from SDK types
            const perm = grantedPermissions[0] as any;

            if (!perm?.context || !perm?.signerMeta?.delegationManager) {
                throw new Error("MetaMask Flask returned incomplete permission data");
            }

            const stored: StoredPermission = {
                context: perm.context,
                delegationManager: perm.signerMeta.delegationManager,
                chainId: currentChainId,
                userAddress: address,
            };

            setPermission(stored);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

            const res = await fetch("/api/yield-agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "store-delegation",
                    permissionContext: stored.context,
                    delegationManager: stored.delegationManager,
                    smartAccountAddress: address,
                    type: "erc7715",
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Backend error ${res.status}`);
            }

        } catch (e) {
            const msg = e instanceof Error ? e.message : "Permission request failed";
            if (
                msg.includes("not supported") ||
                msg.includes("method not found") ||
                msg.includes("not found")
            ) {
                setError("MetaMask Flask 13.5+ required — download at metamask.io/flask");
            } else {
                setError(msg);
            }
        } finally {
            setSigning(false);
        }
    }, [address, agentAddress, chainId]);

    const revoke = useCallback(async () => {
        setPermission(null);
        localStorage.removeItem(STORAGE_KEY);
        await fetch("/api/yield-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "clear-delegation" }),
        }).catch(() => { });
    }, []);

    return {
        delegation: permission ? ({ delegate: agentAddress } as any) : null,
        permission,
        signing,
        error,
        createAndSign,
        revoke,
    };
}