// LI.FI bridge for cross-chain USDC transfers
//
// Quote + execution flow (LI.FI SDK v3):
//   getQuote(params)          → LiFiStep (transactionRequest already populated)
//   convertQuoteToRoute(step) → Route
//   executeRoute(route, hooks)→ execute on-chain
//
// Two quoting methods:
//   fetchQuoteCost()   — lightweight: getQuote only, returns cost for LLM pre-decision
//   getDryRunQuote()   — full dry-run: getQuote + eth_call simulation
//
// Source: https://docs.li.fi/llms.txt

import {
  createPublicClient,
  http,
  type Chain,
  type PublicClient,
} from "viem";
import { base, arbitrum, optimism, polygon } from "viem/chains";
import { getQuote, executeRoute, convertQuoteToRoute } from "@lifi/sdk";
import { initLiFi } from "../shared/lifiClient";
import { YIELD_CHAINS } from "../shared/config";
import { ERC20_ABI } from "../abi/aaveV3Pool";
import type { BridgeRoute, LogEntry } from "@/types";

const CHAIN_MAP: Record<number, Chain> = {
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
};

export class YieldBridge {
  private privateKey: string;
  private address: `0x${string}`;
  private onLog: (log: Omit<LogEntry, "id">) => void;

  constructor(
    privateKey: string,
    address: string,
    onLog?: (log: Omit<LogEntry, "id">) => void
  ) {
    this.privateKey = privateKey;
    this.address = address as `0x${string}`;
    this.onLog = onLog ?? (() => { });
    // Do not init here — init per-operation with the correct source chain
  }

  private log(level: LogEntry["level"], message: string) {
    this.onLog({ timestamp: Date.now(), level, message });
  }

  private publicClient(chainId: number): PublicClient {
    const chain = CHAIN_MAP[chainId];
    if (!chain) throw new Error(`No public client for chain ${chainId}`);
    return createPublicClient({
      chain,
      transport: http(YIELD_CHAINS[chainId]?.rpcUrl),
    }) as PublicClient;
  }

  /**
   * Lightweight quote — getQuote only, no eth_call.
   * Use this before the LLM decision to get real bridge cost.
   */
  async fetchQuoteCost(
    fromChainId: number,
    toChainId: number,
    amount: bigint
  ): Promise<{
    estimatedOutput: string;
    bridgeName: string;
    estimatedTime: number;
    bridgeCostUsdc: number;
  }> {
    const from = YIELD_CHAINS[fromChainId];
    const to = YIELD_CHAINS[toChainId];
    if (!from || !to) throw new Error(`Unsupported chain pair: ${fromChainId} → ${toChainId}`);

    // Ensure SDK is initialized before any API call
    initLiFi(this.privateKey, fromChainId);

    const step = await getQuote({
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken: from.usdc,
      toToken: to.usdc,
      fromAmount: amount.toString(),
      fromAddress: this.address,
      integrator: process.env.LIFI_INTEGRATOR ?? "brahma",
      slippage: 0.005, // 0.5% — tight for stablecoin-to-stablecoin
    });

    const estimatedOutput = step.estimate?.toAmount ?? "0";
    const bridgeName = step.toolDetails?.name ?? "aggregated";
    const estimatedTime = step.estimate?.executionDuration ?? 60;
    const bridgeCostUsdc = (Number(amount) - Number(estimatedOutput)) / 1e6;

    return { estimatedOutput, bridgeName, estimatedTime, bridgeCostUsdc };
  }

  /**
   * Full dry-run — getQuote + eth_call simulation of the bridge tx.
   * Use this in DRY_RUN mode for the actual bridge step validation.
   */
  async getDryRunQuote(
    fromChainId: number,
    toChainId: number,
    amount: bigint
  ): Promise<{
    estimatedOutput: string;
    bridgeName: string;
    estimatedTime: number;
    bridgeCostUsdc: number;
  }> {
    const from = YIELD_CHAINS[fromChainId];
    const to = YIELD_CHAINS[toChainId];
    if (!from || !to) throw new Error(`Unsupported chain pair: ${fromChainId} → ${toChainId}`);

    // Ensure SDK is initialized
    initLiFi(this.privateKey, fromChainId);

    this.log(
      "INFO",
      `[DRY RUN] Quoting LI.FI: ${from.name} → ${to.name} | ${(Number(amount) / 1e6).toFixed(4)} USDC`
    );

    const step = await getQuote({
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken: from.usdc,
      toToken: to.usdc,
      fromAmount: amount.toString(),
      fromAddress: this.address,
      integrator: process.env.LIFI_INTEGRATOR ?? "brahma",
      slippage: 0.005,
    });

    const bridgeName = step.toolDetails?.name ?? "aggregated";
    const estimatedOutput = step.estimate?.toAmount ?? "0";
    const estimatedTime = step.estimate?.executionDuration ?? 60;
    const bridgeCostUsdc = (Number(amount) - Number(estimatedOutput)) / 1e6;

    this.log(
      "INFO",
      `[DRY RUN] Route via ${bridgeName} | est. out: ${(Number(estimatedOutput) / 1e6).toFixed(4)} USDC | fee: ${bridgeCostUsdc.toFixed(4)} USDC`
    );

    const txReq = step.transactionRequest;

    if (txReq?.to && txReq?.data) {
      const client = this.publicClient(fromChainId);

      try {
        await client.simulateContract({
          address: from.usdc,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [txReq.to as `0x${string}`, amount],
          account: this.address,
        });
        this.log("SUCCESS", `[DRY RUN] Approval simulation passed`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log("WARN", `[DRY RUN] Approval sim note: ${msg.slice(0, 80)}`);
      }

      try {
        await client.call({
          account: this.address,
          to: txReq.to as `0x${string}`,
          data: txReq.data as `0x${string}`,
          value: txReq.value ? BigInt(txReq.value.toString()) : 0n,
        });
        this.log("SUCCESS", `[DRY RUN] Bridge tx simulation passed`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log(
          "WARN",
          `[DRY RUN] Bridge sim revert (expected — approval-gated): ${msg.slice(0, 100)}`
        );
      }
    } else {
      this.log("WARN", `[DRY RUN] Quote returned no transactionRequest — skipping eth_call`);
    }

    return { estimatedOutput, bridgeName, estimatedTime, bridgeCostUsdc };
  }

  /**
   * Live bridge — getQuote → convertQuoteToRoute → executeRoute.
   * initLiFi is called with the actual fromChainId so the wallet client
   * is on the correct source chain from the start.
   */
  async executeBridge(
    fromChainId: number,
    toChainId: number,
    amount: bigint
  ): Promise<BridgeRoute> {
    const from = YIELD_CHAINS[fromChainId];
    const to = YIELD_CHAINS[toChainId];
    if (!from || !to) throw new Error(`Unsupported chain pair: ${fromChainId} → ${toChainId}`);

    // Init with source chain — ensures wallet client is on the right chain
    initLiFi(this.privateKey, fromChainId);

    this.log(
      "INFO",
      `Bridging ${(Number(amount) / 1e6).toFixed(4)} USDC: ${from.name} → ${to.name} via LI.FI`
    );

    const step = await getQuote({
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken: from.usdc,
      toToken: to.usdc,
      fromAmount: amount.toString(),
      fromAddress: this.address,
      integrator: process.env.LIFI_INTEGRATOR ?? "brahma",
      slippage: 0.005, // 0.5% — tight for stablecoin-to-stablecoin
    });

    const bridgeName = step.toolDetails?.name ?? "aggregated";
    const estimatedOutput = step.estimate?.toAmount ?? "0";

    if (!step.transactionRequest?.to) {
      throw new Error(`LI.FI quote returned no transactionRequest — aborting bridge`);
    }

    this.log(
      "SUCCESS",
      `LI.FI quote via ${bridgeName} — est. out: ${(Number(estimatedOutput) / 1e6).toFixed(4)} USDC | min: ${(Number(step.estimate?.toAmountMin ?? "0") / 1e6).toFixed(4)} USDC`
    );

    // convertQuoteToRoute wraps LiFiStep into a Route for executeRoute
    const route = convertQuoteToRoute(step);

    const start = Date.now();

    await executeRoute(route, {
      updateRouteHook: (updated) => {
        const s = updated.steps?.[0];
        if (s?.execution?.status) {
          this.log("INFO", `Bridge: ${s.execution.status}`);
        }
      },
    });

    const elapsed = Date.now() - start;
    this.log("SUCCESS", `Bridge complete — ${elapsed}ms`);

    return {
      fromChainId,
      toChainId,
      fromToken: from.usdc,
      toToken: to.usdc,
      fromAmount: amount.toString(),
      estimatedOutput,
      bridgeUsed: bridgeName,
      executionTime: elapsed,
    };
  }

  /**
   * Get a LI.FI route for ERC-7715 manual execution.
   * Returns the raw tx calldata + native msg.value so the agent can
   * submit it as a delegation call with the correct ETH attached.
   *
   * KEY FIX: LI.FI bridge txs often require a native token fee as msg.value
   * (e.g. LayerZero messaging fee). The LI.FI SDK types don't expose `value`
   * on transactionRequest, so we cast to `any` to read it, then normalize to
   * bigint. Without this, bridgeNativeValue is always 0n and the tx fails with
   * "total cost exceeds balance" even when the agent has enough ETH for gas.
   */
  async getRouteForExecution(
    fromChainId: number,
    toChainId: number,
    amount: bigint,
    recipient: `0x${string}`
  ): Promise<{
    to: string;
    data: string;
    approvalAddress: string;
    estimatedOutput: bigint;
    value?: bigint;        // native msg.value required by the bridge protocol
  } | null> {
    try {
      const fromChain = YIELD_CHAINS[fromChainId];
      const toChain = YIELD_CHAINS[toChainId];
      if (!fromChain || !toChain) return null;

      initLiFi(this.privateKey, fromChainId);

      const { getRoutes, getStepTransaction } = await import("@lifi/sdk");

      const routesResult = await getRoutes({
        fromChainId,
        toChainId,
        fromTokenAddress: fromChain.usdc,
        toTokenAddress: toChain.usdc,
        fromAmount: amount.toString(),
        fromAddress: recipient, // user wallet is sender
        toAddress: recipient, // user wallet receives on target chain
        options: {
          slippage: 0.03,
          integrator: process.env.LIFI_INTEGRATOR ?? "brahma",
        },
      });

      const route = routesResult.routes[0];
      if (!route?.steps?.[0]) return null;

      const step = route.steps[0];
      const tx = await getStepTransaction(step);

      if (!tx.transactionRequest?.to || !tx.transactionRequest?.data) {
        this.log("ERROR", "getRouteForExecution: no transactionRequest in step");
        return null;
      }

      // Cast to any — LI.FI SDK types omit `value` but it is present at runtime
      // when the bridge protocol (e.g. LayerZero, Stargate) requires a native fee.
      const rawTx = tx.transactionRequest as {
        to?: string;
        data?: string;
        value?: string | bigint | number;
      };

      // Normalize value: handles hex ("0x38d7ea4c68000"), decimal string, number, bigint, or absent.
      let nativeValue: bigint | undefined;
      if (rawTx.value != null) {
        const raw = rawTx.value.toString();
        // Treat "0x", "0x0", "0", and "" as no fee
        if (raw !== "" && raw !== "0x" && raw !== "0x0" && raw !== "0") {
          try {
            nativeValue = BigInt(raw);
          } catch {
            // Malformed value — treat as no fee
            this.log("WARN", `getRouteForExecution: could not parse value "${raw}" — treating as 0`);
          }
        }
      }

      this.log(
        "INFO",
        `[ERC-7715] LI.FI route — bridge fee (msg.value): ${nativeValue != null
          ? `${(Number(nativeValue) / 1e18).toFixed(8)} ETH`
          : "none"
        } | est. output: ${(Number(route.toAmountMin ?? route.toAmount) / 1e6).toFixed(4)} USDC`
      );

      return {
        to: rawTx.to as string,
        data: rawTx.data as string,
        approvalAddress: step.estimate.approvalAddress,
        estimatedOutput: BigInt(route.toAmountMin ?? route.toAmount),
        value: nativeValue,
      };
    } catch (e) {
      this.log(
        "ERROR",
        `getRouteForExecution failed: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`
      );
      return null;
    }
  }
}