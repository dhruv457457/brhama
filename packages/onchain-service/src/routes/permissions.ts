import { Router } from "express";
import {
  getRemainingAllowance,
  createSubDelegation,
  redeemDelegationAndTransfer,
  revokePermission,
} from "../services/delegationService.js";
import { executePayments } from "../services/executionService.js";
import { getWalletForHandle, getReputation } from "../services/registryService.js";
import {
  savePermission,
  getPermissions,
  getActivePermission,
  revokeStoredPermission,
} from "../services/permissionStore.js";
import { publicClient, agentAccount, CONFIG } from "../config.js";
import { createWalletClient, http, parseUnits, encodeFunctionData } from "viem";
import { sepolia } from "viem/chains";

const router = Router();

// Check remaining ERC-7715 period allowance
router.post("/allowance", async (req, res) => {
  try {
    const { permissionsContext } = req.body;
    const remaining = await getRemainingAllowance(permissionsContext);
    res.json({ remaining });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a sub-delegation for a contributor
router.post("/sub-delegation", async (req, res) => {
  try {
    const { parentPermissionsContext, delegateAddress, amountUsdc, delegationManager } = req.body;
    const subContext = await createSubDelegation(
      parentPermissionsContext,
      delegateAddress,
      amountUsdc,
      delegationManager
    );
    res.json({ subPermissionsContext: subContext });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Execute batch payments
router.post("/execute-payments", async (req, res) => {
  try {
    const { payments } = req.body;
    const results = await executePayments(payments);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Permission Storage (MongoDB with JSON fallback) ──

// Save a signed permission
router.post("/store", async (req, res) => {
  try {
    const {
      walletAddress,
      repoName,
      budget,
      periodDays,
      expiryDays,
      agentAddress,
      permissionsContext,
      delegationManager,
      expiresAt,
    } = req.body;

    if (!walletAddress || !permissionsContext) {
      return res.status(400).json({ error: "walletAddress and permissionsContext are required" });
    }

    const stored = await savePermission({
      walletAddress,
      repoName: repoName || "unknown",
      budget: budget || "0",
      periodDays: periodDays || "30",
      expiryDays: expiryDays || "90",
      agentAddress: agentAddress || "",
      permissionsContext,
      delegationManager: delegationManager || "",
      expiresAt: expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

    res.json({ success: true, permission: stored });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all permissions for a wallet
router.get("/list/:walletAddress", async (req, res) => {
  try {
    const perms = await getPermissions(req.params.walletAddress);
    res.json({ permissions: perms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get the active permission for a wallet
router.get("/active/:walletAddress", async (req, res) => {
  try {
    const perm = await getActivePermission(req.params.walletAddress);
    res.json({ permission: perm });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke a stored permission by ID
router.post("/revoke-stored", async (req, res) => {
  try {
    const { permissionId } = req.body;
    if (!permissionId) {
      return res.status(400).json({ error: "permissionId is required" });
    }
    const success = await revokeStoredPermission(permissionId);
    if (!success) {
      return res.status(404).json({ error: "Permission not found" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke a permission (on-chain)
router.post("/revoke", async (req, res) => {
  try {
    const { permissionsContext } = req.body;
    await revokePermission(permissionsContext);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Lookup wallet for GitHub handle
router.get("/wallet/:handle", async (req, res) => {
  try {
    const wallet = await getWalletForHandle(req.params.handle);
    res.json({ handle: req.params.handle, wallet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get contributor reputation
router.get("/reputation/:address", async (req, res) => {
  try {
    const rep = await getReputation(req.params.address as `0x${string}`);
    res.json({
      address: req.params.address,
      totalEarned: rep.totalEarned.toString(),
      totalPayouts: rep.totalPayouts.toString(),
      reputationScore: rep.reputationScore.toString(),
      lastPaidAt: rep.lastPaidAt.toString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Agent On-Chain Verification ──

// Check if an agent address is registered on the ContributorRegistry
router.post("/verify-agents", async (req, res) => {
  try {
    const { addresses } = req.body;
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: "addresses array is required" });
    }

    const results: Array<{
      address: string;
      registered: boolean;
      handle: string | null;
      totalEarned: string;
      totalPayouts: string;
      reputationScore: string;
    }> = [];

    for (const addr of addresses) {
      try {
        const rep = await getReputation(addr as `0x${string}`);
        const hasActivity = Number(rep.totalPayouts) > 0 || Number(rep.reputationScore) > 0;

        results.push({
          address: addr,
          registered: hasActivity,
          handle: null,
          totalEarned: rep.totalEarned.toString(),
          totalPayouts: rep.totalPayouts.toString(),
          reputationScore: rep.reputationScore.toString(),
        });
      } catch {
        results.push({
          address: addr,
          registered: false,
          handle: null,
          totalEarned: "0",
          totalPayouts: "0",
          reputationScore: "0",
        });
      }
    }

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── USDC Faucet (Testnet Only) ──

const MINT_ABI = [{
  name: "mint",
  type: "function",
  inputs: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [],
  stateMutability: "nonpayable",
}] as const;

// Mint test USDC to any address (max 5000 per request)
router.post("/faucet", async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    if (!toAddress) {
      return res.status(400).json({ error: "toAddress is required" });
    }

    const mintAmount = Math.min(parseFloat(amount) || 1000, 5000);
    const amountWei = parseUnits(mintAmount.toString(), 6);

    const walletClient = createWalletClient({
      account: agentAccount,
      chain: sepolia,
      transport: http(CONFIG.sepoliaRpcUrl),
    });

    const txHash = await walletClient.writeContract({
      address: CONFIG.usdcAddress,
      abi: MINT_ABI,
      functionName: "mint",
      args: [toAddress as `0x${string}`, amountWei],
    });

    console.log(`[Faucet] Minted ${mintAmount} USDC to ${toAddress}: ${txHash}`);

    res.json({
      success: true,
      txHash,
      amount: mintAmount,
      toAddress,
    });
  } catch (err: any) {
    console.error("[Faucet] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get USDC balance for an address
router.get("/balance/:address", async (req, res) => {
  try {
    const balance = await publicClient.readContract({
      address: CONFIG.usdcAddress,
      abi: [{
        name: "balanceOf",
        type: "function",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      }],
      functionName: "balanceOf",
      args: [req.params.address as `0x${string}`],
    });

    res.json({
      address: req.params.address,
      balance: (Number(balance) / 1e6).toString(),
      raw: balance.toString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
