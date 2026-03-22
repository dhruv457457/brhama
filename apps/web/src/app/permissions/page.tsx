"use client";

import { useState, useEffect, useCallback } from "react";
import { PermissionGrant } from "@/components/wallet/PermissionGrant";
import { useWalletStore } from "@/store/walletStore";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { ONCHAIN_SERVICE_URL } from "@/lib/constants";

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

export default function PermissionsPage() {
  const { address, walletType, connect, setPermissionsContext, setDelegationManager } = useWalletStore();
  const [permissions, setPermissions] = useState<StoredPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showGrantForm, setShowGrantForm] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/list/${address}`);
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions || []);

        // Auto-load active permission into wallet store
        const active = data.permissions?.find((p: StoredPermission) => p.status === "active");
        if (active) {
          setPermissionsContext(active.permissionsContext);
          if (active.delegationManager) {
            setDelegationManager(active.delegationManager);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch permissions:", err);
    } finally {
      setLoading(false);
    }
  }, [address, setPermissionsContext, setDelegationManager]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const handleRevoke = async (permissionId: string) => {
    if (!confirm("Revoke this permission? The AI agent will no longer be able to distribute rewards.")) return;

    setRevoking(permissionId);
    try {
      const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/revoke-stored`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId }),
      });
      if (res.ok) {
        await fetchPermissions();
      }
    } catch (err) {
      console.error("Failed to revoke:", err);
    } finally {
      setRevoking(null);
    }
  };

  const handleUsePermission = (perm: StoredPermission) => {
    setPermissionsContext(perm.permissionsContext);
    if (perm.delegationManager) {
      setDelegationManager(perm.delegationManager);
    }
  };

  if (!address) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <GlassCard className="max-w-md text-center">
          <p className="text-white/60 mb-4">
            Connect your wallet to manage permissions
          </p>
          <GlassButton variant="primary" onClick={connect}>
            Connect Wallet
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  const activePerms = permissions.filter((p) => p.status === "active");
  const pastPerms = permissions.filter((p) => p.status !== "active");

  return (
    <div className="py-8 max-w-4xl mx-auto px-4">
      <h1 className="text-3xl font-bold text-center mb-2">
        Permission Management
      </h1>
      <p className="text-center text-sm text-white/40 mb-8">
        {walletType === "flask"
          ? "Manage your ERC-7715 permissions for contributor rewards"
          : "Demo mode — install MetaMask Flask for real ERC-7715 permissions"}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Active Permissions */}
          {activePerms.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Active Permissions
              </h2>
              <div className="space-y-4">
                {activePerms.map((perm) => (
                  <GlassCard key={perm.id} className="relative">
                    {/* Status badge */}
                    <div className="absolute top-4 right-4 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-xs text-emerald-300 font-medium">
                      ACTIVE
                    </div>

                    <div className="space-y-4">
                      {/* Repo + Budget header */}
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {perm.repoName}
                        </h3>
                        <p className="text-sm text-white/40">
                          Granted {new Date(perm.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          ["Budget", `${perm.budget} USDC`],
                          ["Period", `${perm.periodDays} days`],
                          ["Expires", new Date(perm.expiresAt).toLocaleDateString()],
                          ["Agent", `${perm.agentAddress.slice(0, 8)}...`],
                        ].map(([label, value]) => (
                          <div key={label} className="glass-card-sm p-3">
                            <div className="text-xs text-white/40 mb-1">{label}</div>
                            <div className="text-sm font-mono text-purple-300">{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Context preview */}
                      <div className="glass-card-sm p-3">
                        <div className="text-xs text-white/40 mb-1">Permissions Context</div>
                        <div className="font-mono text-xs text-white/50 break-all max-h-12 overflow-hidden">
                          {perm.permissionsContext.slice(0, 120)}
                          {perm.permissionsContext.length > 120 ? "..." : ""}
                        </div>
                      </div>

                      {perm.delegationManager && (
                        <div className="glass-card-sm p-3">
                          <div className="text-xs text-white/40 mb-1">Delegation Manager</div>
                          <div className="font-mono text-xs text-purple-300">
                            {perm.delegationManager}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3">
                        <GlassButton
                          size="sm"
                          className="flex-1"
                          onClick={() => handleUsePermission(perm)}
                        >
                          Load into Dashboard
                        </GlassButton>
                        <GlassButton
                          size="sm"
                          className="flex-1 border-red-500/30 hover:bg-red-500/10 text-red-400"
                          onClick={() => handleRevoke(perm.id)}
                          disabled={revoking === perm.id}
                        >
                          {revoking === perm.id ? "Revoking..." : "Revoke Permission"}
                        </GlassButton>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Grant new permission button / form */}
          {activePerms.length > 0 && !showGrantForm ? (
            <div className="text-center mb-8">
              <GlassButton
                variant="primary"
                onClick={() => setShowGrantForm(true)}
              >
                Grant New Permission
              </GlassButton>
              <p className="text-xs text-white/30 mt-2">
                This will replace your current active permission for the same repo
              </p>
            </div>
          ) : (
            <div className="mb-8">
              {activePerms.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setShowGrantForm(false)}
                    className="text-sm text-white/40 hover:text-white/60"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <PermissionGrant onSuccess={fetchPermissions} />
            </div>
          )}

          {/* Past Permissions */}
          {pastPerms.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-white/60">
                Past Permissions
              </h2>
              <div className="space-y-3">
                {pastPerms.map((perm) => (
                  <GlassCard key={perm.id} className="opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-white/80">{perm.repoName}</h3>
                        <p className="text-xs text-white/40">
                          {perm.budget} USDC / {perm.periodDays} days
                          {" · "}
                          {new Date(perm.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        perm.status === "revoked"
                          ? "bg-red-500/20 border border-red-500/30 text-red-400"
                          : "bg-yellow-500/20 border border-yellow-500/30 text-yellow-400"
                      }`}>
                        {perm.status.toUpperCase()}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
