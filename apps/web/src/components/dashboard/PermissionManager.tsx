"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletStore } from "@/store/walletStore";
import { USDC_SEPOLIA_ADDRESS, ONCHAIN_SERVICE_URL } from "@/lib/constants";
import { createWalletClient, custom, parseUnits } from "viem";
import { sepolia } from "viem/chains";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

interface StoredPermission {
  id: string;
  walletAddress: string;
  repoName: string;
  budget: string;
  periodDays: string;
  expiryDays: string;
  agentAddress: string;
  permissionsContext: string;
  delegationManager: string;
  createdAt: string;
  expiresAt: string;
  status: "active" | "revoked" | "expired";
}

interface PermissionManagerProps {
  onPermissionChange?: () => void;
}

export function PermissionManager({ onPermissionChange }: PermissionManagerProps) {
  const { address, walletType, setPermissionsContext, setDelegationManager, permissionsContext } = useWalletStore();
  const [permissions, setPermissions] = useState<StoredPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Grant form
  const [budget, setBudget] = useState("1000");
  const [periodDays, setPeriodDays] = useState("30");
  const [status, setStatus] = useState<"idle" | "signing" | "success" | "error">("idle");
  const [grantError, setGrantError] = useState("");
  const agentAddress = "0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a";

  const fetchPermissions = useCallback(async () => {
    if (!address) { setLoading(false); return; }
    try {
      const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/list/${address}`);
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions || []);
        const active = data.permissions?.find((p: StoredPermission) => p.status === "active");
        if (active) {
          setPermissionsContext(active.permissionsContext);
          if (active.delegationManager) setDelegationManager(active.delegationManager);
        }
      }
    } catch {} finally { setLoading(false); }
  }, [address, setPermissionsContext, setDelegationManager]);

  // Fetch remaining allowance
  const fetchRemaining = useCallback(async () => {
    if (!permissionsContext) return;
    try {
      const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/allowance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionsContext }),
      });
      if (res.ok) {
        const data = await res.json();
        setRemaining(data.remaining ?? null);
      }
    } catch {}
  }, [permissionsContext]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);
  useEffect(() => { fetchRemaining(); }, [fetchRemaining]);

  const handleRevoke = async (permissionId: string) => {
    if (!confirm("Revoke this permission? All agents lose spending power.")) return;
    setRevoking(permissionId);
    try {
      const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/revoke-stored`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId }),
      });
      if (res.ok) {
        await fetchPermissions();
        onPermissionChange?.();
      }
    } catch {} finally { setRevoking(null); }
  };

  const handleUse = (perm: StoredPermission) => {
    setPermissionsContext(perm.permissionsContext);
    if (perm.delegationManager) setDelegationManager(perm.delegationManager);
    onPermissionChange?.();
  };

  async function handleGrant() {
    if (!window.ethereum || !address) return;
    setStatus("signing");
    setGrantError("");

    try {
      const periodSeconds = parseInt(periodDays) * 24 * 60 * 60;
      const currentTime = Math.floor(Date.now() / 1000);
      const expiry = currentTime + 90 * 24 * 60 * 60;

      const baseWalletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum),
        account: address as `0x${string}`,
      });
      const walletClient = baseWalletClient.extend(erc7715ProviderActions());

      const grantedPermissions = await walletClient.requestExecutionPermissions([{
        chainId: sepolia.id,
        to: agentAddress as `0x${string}`,
        expiry,
        isAdjustmentAllowed: true,
        permission: {
          type: "erc20-token-periodic" as const,
          data: {
            tokenAddress: USDC_SEPOLIA_ADDRESS as `0x${string}`,
            periodAmount: parseUnits(budget, 6),
            periodDuration: periodSeconds,
            startTime: currentTime,
            justification: `Pact: AI agent economy`,
          },
        },
      }]);

      if (!grantedPermissions || grantedPermissions.length === 0) throw new Error("Denied");

      const pd = grantedPermissions[0] as any;
      const ctx = pd?.context || JSON.stringify(grantedPermissions);
      const dm = pd?.signerMeta?.delegationManager || "";
      setPermissionsContext(ctx);
      if (dm) setDelegationManager(dm);

      try {
        await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/store`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address, repoName: "Agent Economy", budget, periodDays, expiryDays: "90", agentAddress,
            permissionsContext: ctx, delegationManager: dm,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        });
      } catch {}

      setStatus("success");
      setShowGrant(false);
      fetchPermissions();
      fetchRemaining();
      onPermissionChange?.();
    } catch (err: any) {
      setGrantError(err.message || "Failed");
      setStatus("error");
    }
  }

  async function handleDemoGrant() {
    setStatus("signing");
    await new Promise((r) => setTimeout(r, 1200));
    const demoCtx = `demo_permissions_economy_${budget}_${Date.now()}`;
    setPermissionsContext(demoCtx);

    try {
      await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address, repoName: "Agent Economy", budget, periodDays, expiryDays: "90", agentAddress,
          permissionsContext: demoCtx, delegationManager: "",
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
    } catch {}

    setStatus("success");
    setShowGrant(false);
    fetchPermissions();
    fetchRemaining();
    onPermissionChange?.();
  }

  const activePerms = permissions.filter((p) => p.status === "active");
  const pastPerms = permissions.filter((p) => p.status !== "active");
  const hasActive = activePerms.length > 0 || !!permissionsContext;

  // Budget exhausted?
  const isExhausted = remaining !== null && remaining <= 0;

  // If we have an active permission, show compact inline bar
  if (hasActive && !showGrant) {
    const activePerm = activePerms[0];
    const budgetNum = activePerm ? parseFloat(activePerm.budget) : 0;
    const usedPercent = budgetNum > 0 && remaining !== null ? Math.min(((budgetNum - remaining) / budgetNum) * 100, 100) : 0;

    return (
      <div className="card-sm p-4 flex items-center gap-4 flex-wrap">
        {/* Status dot */}
        <div className="flex items-center gap-2">
          <span className="relative">
            <span className="w-2 h-2 rounded-full bg-emerald-400 block" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 block absolute inset-0 animate-ping opacity-20" />
          </span>
          <span className="text-[12px] font-medium text-white/50">Treasury Active</span>
        </div>

        {/* Budget bar */}
        <div className="flex-1 min-w-[140px]">
          <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isExhausted ? "bg-red-400/60" : "bg-white/20"}`}
              initial={{ width: 0 }}
              animate={{ width: `${usedPercent}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>

        {/* Remaining */}
        <div className="flex items-center gap-3">
          <span className={`text-[14px] font-mono font-semibold ${isExhausted ? "text-red-400/70" : "text-white/70"}`}>
            {remaining !== null ? `$${remaining}` : `$${budgetNum}`}
          </span>
          <span className="text-[11px] text-white/20">remaining</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isExhausted && (
            <button
              onClick={() => { setShowGrant(true); setStatus("idle"); setGrantError(""); }}
              className="btn btn-primary px-3 py-1.5 text-[11px]"
            >
              Increase Budget
            </button>
          )}
          {!isExhausted && (
            <button
              onClick={() => { setShowGrant(true); setStatus("idle"); setGrantError(""); }}
              className="text-[11px] text-white/20 hover:text-white/40 font-mono transition-colors"
            >
              manage
            </button>
          )}
          {activePerm && (
            <button
              onClick={() => handleRevoke(activePerm.id)}
              disabled={revoking === activePerm?.id}
              className="text-[11px] text-red-400/20 hover:text-red-400/50 font-mono transition-colors"
            >
              revoke
            </button>
          )}
        </div>
      </div>
    );
  }

  // No permission or showing grant form
  return (
    <div className="card p-6">
      <AnimatePresence>
        {showGrant || !hasActive ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/[0.07] flex items-center justify-center">
                  <span className="text-[13px] text-white/55 font-mono">$</span>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-white/70">
                    {isExhausted ? "Budget Exhausted" : hasActive ? "Update Permission" : "Fund Agents"}
                  </p>
                  {isExhausted && (
                    <p className="text-[11px] text-red-400/50 font-mono mt-0.5">
                      You've used all allocated funds. Grant a new permission to continue.
                    </p>
                  )}
                </div>
              </div>
              {hasActive && (
                <button onClick={() => setShowGrant(false)} className="text-[11px] text-white/20 hover:text-white/40 font-mono">
                  cancel
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Budget (USDC)</label>
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="input w-full px-4 py-2.5 font-mono" />
              </div>
              <div>
                <label className="block text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Period (days)</label>
                <input type="number" value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} className="input w-full px-4 py-2.5 font-mono" />
              </div>
            </div>

            {grantError && <p className="text-[12px] text-red-400/55 mb-3">{grantError}</p>}

            <div className="flex gap-2">
              <button
                className="btn btn-primary flex-1 py-2.5 text-[13px]"
                onClick={handleGrant}
                disabled={status === "signing"}
              >
                {status === "signing" ? "Signing..." : "Sign with MetaMask"}
              </button>
              <button
                className="btn btn-default flex-1 py-2.5 text-[13px]"
                onClick={handleDemoGrant}
                disabled={status === "signing"}
              >
                Demo Mode
              </button>
            </div>

            {walletType !== "flask" && (
              <p className="text-[10px] text-white/12 text-center font-mono mt-3">
                Real ERC-7715 requires MetaMask Flask 13.5.0+
              </p>
            )}

            {/* Past permissions */}
            {pastPerms.length > 0 && (
              <details className="mt-4 group">
                <summary className="text-[11px] text-white/15 cursor-pointer hover:text-white/30 font-mono transition-colors flex items-center gap-1.5">
                  <span className="text-[9px] group-open:rotate-90 transition-transform">&#9654;</span>
                  {pastPerms.length} past permission{pastPerms.length > 1 ? "s" : ""}
                </summary>
                <div className="mt-2 space-y-1.5">
                  {pastPerms.map((perm) => (
                    <div key={perm.id} className="card-sm p-3 opacity-40 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-white/30 font-mono">${perm.budget}</span>
                        <span className="text-[10px] text-white/15 font-mono">{new Date(perm.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className={`text-[9px] font-medium uppercase tracking-wider ${
                        perm.status === "revoked" ? "text-red-400/40" : "text-white/20"
                      }`}>{perm.status}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
