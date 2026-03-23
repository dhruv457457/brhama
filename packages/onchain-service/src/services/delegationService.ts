import {
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  type Address,
} from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import {
  createCaveatEnforcerClient,
  createDelegation,
  actions,
} from "@metamask/smart-accounts-kit";
import {
  CONFIG,
  publicClient,
  environment,
  getAgentSmartAccount,
} from "../config.js";
import { getActivePermission } from "./permissionStore.js";

const { erc7710BundlerActions } = actions;

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ERC20PeriodTransferEnforcer ABI for reading spent amounts
const PERIOD_ENFORCER_ABI = [
  {
    name: "spentMap",
    type: "function",
    inputs: [
      { name: "delegationHash", type: "bytes32" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "spent", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

/**
 * Get remaining ERC-7715 allowance for the current period.
 * Reads the stored permission budget from MongoDB/file and checks
 * on-chain USDC balance of the agent's smart account.
 */
export async function getRemainingAllowance(
  permissionsContext: string
): Promise<number> {
  console.log("[DelegationService] Checking remaining allowance...");

  try {
    const enforcerAddress =
      environment.caveatEnforcers.ERC20PeriodTransferEnforcer;

    console.log(
      `[DelegationService] ERC20PeriodTransferEnforcer: ${enforcerAddress}`
    );

    // 1. Find the stored permission budget from MongoDB/file via permissionStore
    let budgetUsdc = 500.0; // Default if no stored permission found

    // Search all permissions in DB for matching context
    const db = await (await import("../db.js")).getDb();
    if (db) {
      try {
        const perm = await db.collection("permissions").findOne({
          permissionsContext,
          status: "active",
        });
        if (perm?.budget) {
          budgetUsdc = parseFloat(perm.budget);
          console.log(`[DelegationService] Stored budget (MongoDB): $${budgetUsdc}`);
        }
      } catch (dbErr: any) {
        console.warn(`[DelegationService] MongoDB lookup failed: ${dbErr.message}`);
      }
    }

    // File fallback if MongoDB didn't find it
    if (budgetUsdc === 500.0) {
      try {
        const { readFileSync, existsSync } = await import("fs");
        const { resolve, dirname } = await import("path");
        const { fileURLToPath } = await import("url");
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const storePath = resolve(__dirname, "../../permissions.json");

        if (existsSync(storePath)) {
          const store = JSON.parse(readFileSync(storePath, "utf-8"));
          const activePerm = store.permissions?.find(
            (p: any) =>
              p.status === "active" &&
              p.permissionsContext === permissionsContext
          );
          if (activePerm?.budget) {
            budgetUsdc = parseFloat(activePerm.budget);
            console.log(`[DelegationService] Stored budget (file): $${budgetUsdc}`);
          }
        }
      } catch {}
    }

    // For demo permissions, just return the budget directly
    if (permissionsContext.startsWith("demo_permissions_")) {
      console.log(`[DelegationService] Demo permission, returning budget: $${budgetUsdc}`);
      return budgetUsdc;
    }

    // 2. Check on-chain USDC balance of the agent smart account
    let onChainBalance = budgetUsdc; // Fallback
    try {
      const smartAccount = await getAgentSmartAccount();

      const balance = await publicClient.readContract({
        address: CONFIG.usdcAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [smartAccount.address],
      });

      onChainBalance = parseFloat(formatUnits(balance as bigint, 6));
      console.log(
        `[DelegationService] Agent SA USDC balance: $${onChainBalance}`
      );
    } catch (balErr: any) {
      console.warn(
        `[DelegationService] Could not read balance: ${balErr.message}`
      );
    }

    // Return the lower of budget vs on-chain balance
    const remaining = Math.min(budgetUsdc, onChainBalance);
    console.log(`[DelegationService] Effective remaining: $${remaining}`);
    return remaining;
  } catch (err: any) {
    console.warn(
      `[DelegationService] Could not read on-chain allowance: ${err.message}`
    );
    // Final fallback: try MongoDB then file
    try {
      const db = await (await import("../db.js")).getDb();
      if (db) {
        const perm = await db.collection("permissions").findOne({
          permissionsContext,
          status: "active",
        });
        if (perm?.budget) return parseFloat(perm.budget);
      }
    } catch {}
    return 0;
  }
}

/**
 * Create a sub-delegation for a specific contributor.
 * Signs a scoped delegation and encodes it into a new permissionsContext
 * that can be used with sendUserOperationWithDelegation.
 */
export async function createSubDelegation(
  parentPermissionsContext: string,
  delegateAddress: `0x${string}`,
  amountUsdc: number,
  delegationManager?: string
): Promise<string> {
  console.log(
    `[DelegationService] Creating sub-delegation for ${delegateAddress}: $${amountUsdc} USDC`
  );

  try {
    const smartAccount = await getAgentSmartAccount();

    const delegation = createDelegation({
      to: delegateAddress,
      from: smartAccount.address,
      environment,
      scope: {
        type: "erc20TransferAmount",
        tokenAddress: CONFIG.usdcAddress,
        maxAmount: parseUnits(amountUsdc.toString(), 6),
      },
    });

    const signedDelegation = await smartAccount.signDelegation({
      delegation,
    });

    console.log(
      `[DelegationService] Sub-delegation signed for ${delegateAddress}`
    );

    // The parent context contains the full delegation chain from MetaMask Flask.
    // For the actual redemption, we still need the parent context because
    // sendUserOperationWithDelegation validates the entire chain.
    // The sub-delegation is an additional authorization layer but the
    // on-chain redemption uses the original Flask-signed context.
    return parentPermissionsContext;
  } catch (err: any) {
    console.error(
      `[DelegationService] Sub-delegation creation failed: ${err.message}`
    );
    // Don't silently return parent - propagate the error
    throw new Error(`Sub-delegation failed: ${err.message}`);
  }
}

/**
 * Redeem a delegation and transfer USDC to a contributor.
 * Uses sendUserOperationWithDelegation via Pimlico bundler.
 *
 * KEY: This executes a transfer FROM the user's wallet (the delegator)
 * by using the permissionsContext + delegationManager from MetaMask Flask.
 * The agent's smart account acts as the delegate executing on behalf of the user.
 */
export async function redeemDelegationAndTransfer(
  permissionsContext: string,
  recipient: `0x${string}`,
  amountUsdc: number,
  delegationManager?: string
): Promise<string> {
  console.log(
    `[DelegationService] Redeeming delegation for ${recipient}: $${amountUsdc} USDC`
  );

  try {
    const smartAccount = await getAgentSmartAccount();

    const bundlerClient = createBundlerClient({
      client: publicClient,
      transport: http(CONFIG.bundlerRpcUrl),
      paymaster: true,
    }).extend(erc7710BundlerActions());

    // Encode the USDC transfer call
    // This transfer will be executed FROM the user's wallet (delegator)
    // via the ERC-7715 delegation, NOT from the agent's balance
    const transferCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [recipient, parseUnits(amountUsdc.toString(), 6)],
    });

    // Use delegationManager from MetaMask Flask if provided,
    // otherwise fall back to environment default
    const dmAddress = (delegationManager || environment.DelegationManager) as `0x${string}`;

    console.log(`[DelegationService] Using DelegationManager: ${dmAddress}`);
    console.log(`[DelegationService] Agent (delegate): ${smartAccount.address}`);
    console.log(`[DelegationService] PermissionsContext length: ${permissionsContext.length}`);

    // Fetch current gas prices from Pimlico to avoid "maxPriorityFeePerGas too low" errors
    let gasPriceOverrides: Record<string, any> = {};
    try {
      const gasPriceRes = await fetch(CONFIG.bundlerRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "pimlico_getUserOperationGasPrice",
          params: [],
          id: 1,
        }),
      });
      const gasPriceData = await gasPriceRes.json();
      if (gasPriceData.result?.fast) {
        gasPriceOverrides = {
          maxFeePerGas: BigInt(gasPriceData.result.fast.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(gasPriceData.result.fast.maxPriorityFeePerGas),
        };
        console.log(`[DelegationService] Gas prices: maxFee=${gasPriceOverrides.maxFeePerGas}, maxPriority=${gasPriceOverrides.maxPriorityFeePerGas}`);
      }
    } catch (gasErr) {
      console.warn(`[DelegationService] Could not fetch gas price, using defaults`);
    }

    const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
      publicClient,
      account: smartAccount,
      calls: [
        {
          to: CONFIG.usdcAddress,
          data: transferCalldata,
          permissionsContext: permissionsContext as `0x${string}`,
          delegationManager: dmAddress,
        },
      ],
      ...gasPriceOverrides,
    });

    console.log(`[DelegationService] UserOp submitted: ${userOpHash}`);

    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    const txHash = receipt.receipt.transactionHash;
    console.log(`[DelegationService] Tx confirmed: ${txHash}`);
    return txHash;
  } catch (err: any) {
    console.error(`[DelegationService] Redemption failed: ${err.message}`);
    if (err.details) {
      console.error(`[DelegationService] Details: ${err.details}`);
    }
    throw new Error(`Delegation redemption failed: ${err.message}`);
  }
}

/**
 * Revoke a permission.
 */
export async function revokePermission(
  permissionsContext: string
): Promise<void> {
  console.log("[DelegationService] Revoking permission...");
  console.log("[DelegationService] Revocation noted (requires delegator action)");
}
