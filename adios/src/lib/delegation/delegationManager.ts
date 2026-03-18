import {
    createDelegation,
    getSmartAccountsEnvironment,
    type Delegation,
    ExecutionMode,
    createExecution,
} from "@metamask/smart-accounts-kit";
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts";
import { base } from "viem/chains";

export const YIELD_CAVEAT_ENFORCER =
    "0xf0423bf51f494ccaf75b122b79388bfe3028ac03" as const;

export const AAVE_V3_POOL =
    "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as const;

export const LIFI_DIAMOND =
    "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE" as const;

export const BASE_CHAIN_ID = base.id;
export const environment = getSmartAccountsEnvironment(BASE_CHAIN_ID);

export function buildYieldDelegation(
  delegatorAddress: `0x${string}`,
  agentAddress: `0x${string}`
): Omit<Delegation, "signature"> {
  return createDelegation({
    from: delegatorAddress,
    to: agentAddress,
    environment,
    // Always provide a numeric salt — never "0x"
    salt: `0x${Date.now().toString(16).padStart(64, "0")}` as `0x${string}`,
    scope: {
      type: "functionCall" as const,
      targets: [AAVE_V3_POOL, LIFI_DIAMOND],
      selectors: [
        "supply(address,uint256,address,uint16)",
        "withdraw(address,uint256,address)",
        "approve(address,uint256)",
        "swapAndStartBridgeTokensViaBridge(tuple,tuple[],address,uint256,bool,bytes)",
        "startBridgeTokensViaBridge(tuple,tuple[])",
      ],
    },
  });
}

export function encodeRedemption(
    signedDelegation: Delegation,
    targetContract: `0x${string}`,
    callData: `0x${string}`,
    value: bigint = 0n
) {
    const execution = createExecution({
        target: targetContract,
        callData,
        value,
    });

    return DelegationManager.encode.redeemDelegations({
        delegations: [[signedDelegation]],
        modes: [ExecutionMode.SingleDefault],
        executions: [[execution]],
    });
}

export type { Delegation };