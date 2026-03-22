"use client";

import { useWalletStore } from "@/store/walletStore";
import { GlassButton } from "../ui/GlassButton";

export function ConnectButton() {
  const { address, walletType, isConnecting, connect, disconnect } =
    useWalletStore();

  if (address) {
    return (
      <div className="flex items-center gap-3">
        {walletType === "flask" && (
          <span className="flask-badge">Flask</span>
        )}
        {walletType === "metamask" && (
          <span className="flask-badge" style={{ color: "#93c5fd", borderColor: "rgba(147,197,253,0.3)", background: "rgba(147,197,253,0.15)" }}>
            View Only
          </span>
        )}
        <span className="text-sm text-white/70 font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <GlassButton size="sm" onClick={disconnect}>
          Disconnect
        </GlassButton>
      </div>
    );
  }

  return (
    <GlassButton
      variant="primary"
      onClick={connect}
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </GlassButton>
  );
}
