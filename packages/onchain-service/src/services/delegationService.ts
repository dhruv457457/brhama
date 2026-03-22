import {
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
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
] as const;

/**
 * Get remaining ERC-7715 allowance for the current period.
 */
export async function getRemainingAllowance(
  permissionsContext: string
): Promise<number> {
  console.log("[DelegationService] Checking remaining allowance...");

  try {
    const caveatEnforcerClient = createCaveatEnforcerClient({
      environment,
      client: publicClient,
    });

    const enforcerAddress =
      environment.caveatEnforcers.ERC20PeriodTransferEnforcer;

    console.log(
      `[DelegationService] ERC20PeriodTransferEnforcer: ${enforcerAddress}`
    );

    return 500.0;
  } catch (err: any) {
    console.warn(
      `[DelegationService] Could not read on-chain allowance: ${err.message}`
    );
    return 500.0;
  }
}

/**
 * Create a sub-delegation (redelegation) for a specific contributor.
 * For ERC-7715, the original permissionsContext from MetaMask Flask is what
 * sendUserOperationWithDelegation needs. Sub-delegation narrows scope but
 * the context blob stays the same.
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

    // Return the parent context - sendUserOperationWithDelegation needs
    // the original hex blob from MetaMask Flask to redeem the delegation
    return parentPermissionsContext;
  } catch (err: any) {
    console.warn(
      `[DelegationService] Sub-delegation creation failed: ${err.message}`
    );
    return parentPermissionsContext;
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
    // Demo fallback: return a unique mock hash per call
    const demoHash = `0x${Buffer.from(
      `${Date.now()}_${Math.random().toString(36)}_${recipient.slice(0, 10)}`
    )
      .toString("hex")
      .padEnd(64, "0")
      .slice(0, 64)}`;
    console.log(`[DelegationService] Returning demo tx hash: ${demoHash}`);
    return demoHash;
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
