import { create } from "zustand";

const ONCHAIN_SERVICE_URL =
  (typeof window !== "undefined" && process.env.NEXT_PUBLIC_ONCHAIN_SERVICE_URL) ||
  "http://localhost:3001";

type WalletType = "flask" | "metamask" | "none";

interface WalletState {
  address: string | null;
  chainId: number | null;
  walletType: WalletType;
  isConnecting: boolean;
  permissionsContext: string | null;
  delegationManager: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  setPermissionsContext: (ctx: string) => void;
  setDelegationManager: (dm: string) => void;
  loadStoredPermission: (address: string) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  chainId: null,
  walletType: "none",
  isConnecting: false,
  permissionsContext: null,
  delegationManager: null,

  connect: async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      set({ walletType: "none" });
      return;
    }

    set({ isConnecting: true });

    try {
      // Detect Flask vs regular MetaMask
      let walletType: WalletType = "metamask";
      try {
        const clientVersion = (await window.ethereum.request({
          method: "web3_clientVersion",
        })) as string;
        if (clientVersion.includes("flask")) {
          walletType = "flask";
        }
      } catch {
        // Ignore detection failure
      }

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const chainId = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;

      const connectedAddress = accounts[0] || null;

      set({
        address: connectedAddress,
        chainId: parseInt(chainId, 16),
        walletType,
        isConnecting: false,
      });

      // Auto-load stored permission from JSON
      if (connectedAddress) {
        get().loadStoredPermission(connectedAddress);
      }

      // Listen for account/chain changes
      window.ethereum.on?.("accountsChanged", (accounts: string[]) => {
        const newAddr = accounts[0] || null;
        set({ address: newAddr, permissionsContext: null, delegationManager: null });
        if (newAddr) {
          get().loadStoredPermission(newAddr);
        }
      });
      window.ethereum.on?.("chainChanged", (chainId: string) => {
        set({ chainId: parseInt(chainId, 16) });
      });
    } catch {
      set({ isConnecting: false });
    }
  },

  disconnect: () => {
    set({
      address: null,
      chainId: null,
      walletType: "none",
      permissionsContext: null,
      delegationManager: null,
    });
  },

  setPermissionsContext: (ctx: string) => {
    set({ permissionsContext: ctx });
  },

  setDelegationManager: (dm: string) => {
    set({ delegationManager: dm });
  },

  loadStoredPermission: async (address: string) => {
    try {
      const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/active/${address}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.permission) {
        console.log("[WalletStore] Loaded stored permission:", data.permission.id);
        set({
          permissionsContext: data.permission.permissionsContext,
          delegationManager: data.permission.delegationManager || null,
        });
      }
    } catch (err) {
      console.warn("[WalletStore] Failed to load stored permission:", err);
    }
  },
}));
