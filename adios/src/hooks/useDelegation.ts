"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { createWalletClient, custom, parseUnits } from "viem";
import { base, polygon } from "viem/chains";

declare global {
    interface Window { ethereum?: any; }
}

const STORAGE_KEY = "brahma_permissions_v2";

export interface ChainPermission {
    context: string;
    delegationManager: string;
    chainId: number;
}

export interface StoredPermissions {
    [chainId: number]: ChainPermission;
    userAddress: string;
}

const CHAIN_CONFIGS: Record<number, { name: string; usdc: string }> = {
    8453: { name: "Base", usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    137:  { name: "Polygon", usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
};

const DELEGATION_MANAGERS: Record<number, string> = {
    8453: "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3",
    137:  "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3",
};

// Push stored permissions to the server (idempotent — safe to call multiple times)
async function syncPermissionsToServer(perms: StoredPermissions): Promise<void> {
    try {
        await fetch("/api/yield-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "store-delegation",
                permissions: perms,
                smartAccountAddress: perms.userAddress,
                type: "erc7715-multi",
            }),
        });
    } catch {
        // Non-fatal — will retry on next render cycle
    }
}

export function useDelegation(agentAddress: string) {
    const { address } = useAccount();

    const [permissions, setPermissions] = useState<StoredPermissions | null>(() => {
        if (typeof window === "undefined") return null;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    });

    const [signing, setSigning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState("");
    const [synced, setSynced] = useState(false);

    // ── KEY FIX: re-sync localStorage permissions to the server on every mount ──
    // The server holds permissions in memory. If the server restarts (Next.js dev,
    // deployment, Vercel cold start), in-memory state is wiped while localStorage
    // still has the grant. Without this, the agent silently falls back to its own
    // wallet funds instead of the user's.
    useEffect(() => {
        if (synced) return;
        if (!permissions) { setSynced(true); return; }

        const chainCount = Object.keys(permissions).filter(k => k !== "userAddress").length;
        if (chainCount === 0) { setSynced(true); return; }

        syncPermissionsToServer(permissions).finally(() => setSynced(true));
    }, [permissions, synced]);

    const createAndSign = useCallback(async () => {
        if (!address) { setError("Connect your wallet first"); return; }
        if (!agentAddress || agentAddress.length < 42) {
            setError("Start the yield agent first");
            return;
        }

        setSigning(true);
        setError(null);
        setProgress("");

        try {
            if (!window.ethereum) {
                throw new Error("MetaMask Flask not found — install it at metamask.io/flask");
            }

            const client7715 = createWalletClient({
                transport: custom(window.ethereum),
            }).extend(erc7715ProviderActions());

            const grantedPermissions: StoredPermissions = { userAddress: address };
            const expiry = Math.floor(Date.now() / 1000) + 604800; // 1 week

            for (const [chainIdStr, chainConfig] of Object.entries(CHAIN_CONFIGS)) {
                const chainId = Number(chainIdStr);
                setProgress(`Requesting permission on ${chainConfig.name}...`);

                try {
                    await window.ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: `0x${chainId.toString(16)}` }],
                    });

                    const result = await client7715.requestExecutionPermissions([{
                        chainId,
                        expiry,
                        isAdjustmentAllowed: true,
                        to: agentAddress,
                        permission: {
                            type: "erc20-token-periodic",
                            data: {
                                tokenAddress: chainConfig.usdc,
                                periodAmount: parseUnits("1000", 6),
                                periodDuration: 86400,
                                justification: `Brahma yield agent: auto-deposits USDC to best Aave V3 APY on ${chainConfig.name}. Guard: only Aave V3 + LI.FI allowed.`,
                            },
                        },
                    } as any]);

                    const perm = result[0] as any;
                    if (!perm?.context) throw new Error(`No context returned for ${chainConfig.name}`);

                    const delegationManager =
                        perm?.signerMeta?.delegationManager ??
                        perm?.delegationManager ??
                        DELEGATION_MANAGERS[chainId];

                    grantedPermissions[chainId] = {
                        context: perm.context,
                        delegationManager,
                        chainId,
                    };

                    console.log(`✅ Permission granted on ${chainConfig.name}:`, perm.context.slice(0, 20));

                } catch (chainErr) {
                    const msg = chainErr instanceof Error ? chainErr.message : String(chainErr);
                    console.warn(`Permission on ${chainConfig.name} failed:`, msg);
                    setProgress(`Warning: ${chainConfig.name} failed, continuing...`);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            const successCount = Object.keys(grantedPermissions).filter(k => k !== "userAddress").length;
            if (successCount === 0) {
                throw new Error("No permissions granted on any chain");
            }

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(grantedPermissions));
            setPermissions(grantedPermissions);

            // Sync to server immediately
            await syncPermissionsToServer(grantedPermissions);

            setProgress(`✅ Permissions granted on ${successCount} chain${successCount > 1 ? "s" : ""} — agent now uses YOUR wallet funds`);

        } catch (e) {
            const msg = e instanceof Error ? e.message : "Permission request failed";
            if (msg.includes("not supported") || msg.includes("method not found")) {
                setError("MetaMask Flask 13.5+ required — download at metamask.io/flask");
            } else {
                setError(msg);
            }
        } finally {
            setSigning(false);
        }
    }, [address, agentAddress]);

    const revoke = useCallback(async () => {
        setPermissions(null);
        setProgress("");
        setSynced(false);
        localStorage.removeItem(STORAGE_KEY);
        await fetch("/api/yield-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "clear-delegation" }),
        }).catch(() => { });
    }, []);

    const chainCount = permissions
        ? Object.keys(permissions).filter(k => k !== "userAddress").length
        : 0;

    return {
        delegation: chainCount > 0 ? ({ delegate: agentAddress } as any) : null,
        permissions,
        signing,
        error,
        progress,
        synced,
        createAndSign,
        revoke,
    };
}