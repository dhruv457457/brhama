"use client";

import { useWalletStore } from "@/store/walletStore";

export function WalletBanner() {
  const { walletType, address } = useWalletStore();

  if (!address) return null;

  if (walletType === "flask") {
    return (
      <div className="mx-4 mt-4 glass-card-sm px-4 py-2 text-sm text-emerald-300 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        MetaMask Flask connected — ERC-7715 Advanced Permissions active
      </div>
    );
  }

  return (
    <div className="mx-4 mt-4 glass-card-sm px-4 py-2 text-sm text-amber-300 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-amber-400" />
      MetaMask connected — view-only mode.{" "}
      <a
        href="https://metamask.io/flask/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-amber-200"
      >
        Install Flask
      </a>{" "}
      for full features.
    </div>
  );
}
