"use client";

import { useState } from "react";
import { GlassCard } from "../ui/GlassCard";
import { GlassButton } from "../ui/GlassButton";
import { useWalletStore } from "@/store/walletStore";
import { USDC_SEPOLIA_ADDRESS, SEPOLIA_CHAIN_ID, ONCHAIN_SERVICE_URL } from "@/lib/constants";
import { createWalletClient, custom, parseUnits } from "viem";
import { sepolia } from "viem/chains";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

interface PermissionGrantProps {
  onSuccess?: () => void;
}

export function PermissionGrant({ onSuccess }: PermissionGrantProps = {}) {
  const { address, walletType, setPermissionsContext, setDelegationManager } = useWalletStore();
  const [budget, setBudget] = useState("500");
  const [repoName, setRepoName] = useState("");
  // Must be the agent's SMART ACCOUNT address (not EOA)
  // EOA 0xF8A440... derives smart account 0xE6a255...
  const [agentAddress, setAgentAddress] = useState(
    "0xE6a2551c175f8FcCDaeA49D02AdF9d4f4C6e849a"
  );
  const [periodDays, setPeriodDays] = useState("30");
  const [expiryDays, setExpiryDays] = useState("90");
  const [status, setStatus] = useState<
    "idle" | "signing" | "success" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [grantedContext, setGrantedContext] = useState("");

  async function handleGrant() {
    if (!window.ethereum || !address) return;

    setStatus("signing");
    setError("");

    try {
      const periodSeconds = parseInt(periodDays) * 24 * 60 * 60;
      const currentTime = Math.floor(Date.now() / 1000);
      const expiry = currentTime + parseInt(expiryDays) * 24 * 60 * 60;

      // Create wallet client with account — same pattern as working MetCow code
      const baseWalletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum),
        account: address as `0x${string}`,
      });

      // Extend with ERC-7715 provider actions
      const walletClient = baseWalletClient.extend(erc7715ProviderActions());

      // Build permission request matching SDK v0.4.0-beta.1 PermissionRequestParameter
      const permissionRequest = {
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
            justification: `Pact: AI contributor rewards for ${repoName}`,
          },
        },
      };

      // Call via SDK v0.4.0-beta.1
      const grantedPermissions = await walletClient.requestExecutionPermissions([
        permissionRequest,
      ]);

      console.log("Permissions Granted:", grantedPermissions);

      if (!grantedPermissions || grantedPermissions.length === 0) {
        throw new Error("Permission request denied or failed");
      }

      // Extract permissions context and delegation manager
      const permissionData = grantedPermissions[0] as any;
      const ctx = permissionData?.context || JSON.stringify(grantedPermissions);
      const dm = permissionData?.signerMeta?.delegationManager || "";
      console.log("Permissions Context:", ctx);
      console.log("Delegation Manager:", dm);
      setPermissionsContext(ctx);
      if (dm) setDelegationManager(dm);
      setGrantedContext(ctx);

      // Persist permission to JSON file via onchain-service
      try {
        const expiryMs = parseInt(expiryDays) * 24 * 60 * 60 * 1000;
        await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/store`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            repoName,
            budget,
            periodDays,
            expiryDays,
            agentAddress,
            permissionsContext: ctx,
            delegationManager: dm,
            expiresAt: new Date(Date.now() + expiryMs).toISOString(),
          }),
        });
        console.log("[PermissionGrant] Permission saved to store");
      } catch (storeErr) {
        console.warn("[PermissionGrant] Failed to persist permission:", storeErr);
      }

      setStatus("success");
      onSuccess?.();
    } catch (err: any) {
      console.error("[PermissionGrant] Error:", err);

      if (
        err.code === -32601 ||
        err.message?.includes("does not exist") ||
        err.message?.includes("not available")
      ) {
        setError(
          "wallet_requestExecutionPermissions is not supported by your MetaMask. " +
          "You need MetaMask Flask 13.5.0+ for real ERC-7715 permissions. " +
          "Use Demo Mode below to test the pipeline."
        );
      } else if (err.code === 4001 || err.message?.includes("rejected") || err.message?.includes("denied")) {
        setError("Permission request rejected by user.");
      } else {
        setError(err.message || "Permission request failed");
      }
      setStatus("error");
    }
  }

  // Demo grant for wallets that don't support ERC-7715
  async function handleDemoGrant() {
    setStatus("signing");
    await new Promise((r) => setTimeout(r, 1500));
    const demoCtx = `demo_permissions_${repoName}_${budget}_${Date.now()}`;
    setPermissionsContext(demoCtx);
    setGrantedContext(demoCtx);

    // Persist demo permission too
    try {
      const expiryMs = parseInt(expiryDays) * 24 * 60 * 60 * 1000;
      await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          repoName,
          budget,
          periodDays,
          expiryDays,
          agentAddress,
          permissionsContext: demoCtx,
          delegationManager: "",
          expiresAt: new Date(Date.now() + expiryMs).toISOString(),
        }),
      });
    } catch (storeErr) {
      console.warn("[PermissionGrant] Failed to persist demo permission:", storeErr);
    }

    setStatus("success");
    onSuccess?.();
  }

  const periodSeconds = parseInt(periodDays) * 24 * 60 * 60;
  const expiryDate = new Date(
    Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000
  );

  return (
    <GlassCard className="max-w-xl mx-auto animate-fade-in">
      <h2 className="text-xl font-semibold mb-1">Grant ERC-7715 Permission</h2>
      <p className="text-sm text-white/40 mb-6">
        Sign once — the AI agent handles the rest
      </p>

      <div className="space-y-5">
        {/* Repo input */}
        <div>
          <label className="block text-sm text-white/60 mb-1.5">
            GitHub Repository
          </label>
          <input
            type="text"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="owner/repo"
            className="glass-input w-full px-4 py-2.5"
          />
        </div>

        {/* Budget + Period row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">
              Budget (USDC)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="glass-input w-full px-4 py-2.5"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1.5">
              Period (days)
            </label>
            <input
              type="number"
              value={periodDays}
              onChange={(e) => setPeriodDays(e.target.value)}
              className="glass-input w-full px-4 py-2.5"
            />
          </div>
        </div>

        {/* Agent address */}
        <div>
          <label className="block text-sm text-white/60 mb-1.5">
            Agent Wallet Address
          </label>
          <input
            type="text"
            value={agentAddress}
            onChange={(e) => setAgentAddress(e.target.value)}
            className="glass-input w-full px-4 py-2.5 font-mono text-xs"
          />
          <p className="text-xs text-white/30 mt-1">
            The orchestrator agent that will distribute rewards
          </p>
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm text-white/60 mb-1.5">
            Permission Expiry (days)
          </label>
          <input
            type="number"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            className="glass-input w-full px-4 py-2.5"
          />
        </div>

        {/* Permission preview card */}
        <div className="glass-card-sm p-5 text-sm space-y-3">
          <p className="text-white/50 text-xs uppercase tracking-wider font-medium">
            ERC-7715 Permission Preview
          </p>
          <div className="space-y-2">
            {[
              ["Permission Type", "erc20-token-periodic"],
              ["Token", `USDC (${USDC_SEPOLIA_ADDRESS.slice(0, 10)}...)`],
              ["Period Amount", `${budget} USDC`],
              ["Period Duration", `${periodDays} days (${periodSeconds.toLocaleString()}s)`],
              ["Expiry", expiryDate.toLocaleDateString()],
              ["Network", "Sepolia (11155111)"],
              ["Adjustment Allowed", "Yes"],
              ["Delegate", `${agentAddress.slice(0, 10)}...${agentAddress.slice(-6)}`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-white/50">{label}</span>
                <span className="font-mono text-purple-300 text-xs">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Delegation flow visual */}
        <div className="glass-card-sm p-4">
          <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">
            Delegation Flow
          </p>
          <div className="flex items-center justify-center gap-2 text-xs">
            <div className="glass-card-sm px-3 py-2 text-center">
              <div className="text-purple-300 font-medium">Your Wallet</div>
              <div className="text-white/30 font-mono mt-0.5">
                {address ? `${address.slice(0, 8)}...` : "Not connected"}
              </div>
            </div>
            <div className="text-white/30">→</div>
            <div className="glass-card-sm px-3 py-2 text-center border-purple-500/30">
              <div className="text-teal-300 font-medium">ERC-7715</div>
              <div className="text-white/30 mt-0.5">{budget} USDC/period</div>
            </div>
            <div className="text-white/30">→</div>
            <div className="glass-card-sm px-3 py-2 text-center">
              <div className="text-blue-300 font-medium">AI Agent</div>
              <div className="text-white/30 font-mono mt-0.5">
                {agentAddress.slice(0, 8)}...
              </div>
            </div>
            <div className="text-white/30">→</div>
            <div className="glass-card-sm px-3 py-2 text-center">
              <div className="text-emerald-300 font-medium">Contributors</div>
              <div className="text-white/30 mt-0.5">Sub-delegations</div>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="glass-card-sm p-3 border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {status === "success" ? (
          <div className="glass-card-sm p-5 text-center space-y-2">
            <div className="text-3xl">&#10003;</div>
            <p className="text-emerald-400 font-semibold text-lg">
              Permission Granted!
            </p>
            <p className="text-sm text-white/50">
              The AI agent can now distribute up to {budget} USDC per{" "}
              {periodDays}-day period to contributors of{" "}
              <span className="text-white/80 font-medium">{repoName}</span>.
            </p>
            {grantedContext && (
              <div className="mt-3">
                <p className="text-xs text-white/30 mb-1">Permissions Context</p>
                <div className="glass-input p-2 font-mono text-xs text-white/50 break-all max-h-20 overflow-auto">
                  {grantedContext.slice(0, 200)}
                  {grantedContext.length > 200 ? "..." : ""}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Primary: real ERC-7715 via SDK */}
            <GlassButton
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleGrant}
              disabled={status === "signing" || !repoName || !budget || !address}
            >
              {status === "signing"
                ? "Approve in MetaMask..."
                : "Sign Permission with MetaMask"}
            </GlassButton>

            {/* Demo mode fallback */}
            <GlassButton
              size="lg"
              className="w-full opacity-60 hover:opacity-100"
              onClick={handleDemoGrant}
              disabled={status === "signing" || !repoName || !budget}
            >
              Demo Mode (no Flask required)
            </GlassButton>

            <p className="text-xs text-white/30 text-center">
              Real ERC-7715 requires{" "}
              <a
                href="https://chromewebstore.google.com/detail/metamask-flask/ljfoeinjpaedjfecbmggjgodbgkmjkjk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 underline"
              >
                MetaMask Flask 13.5.0+
              </a>
            </p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
