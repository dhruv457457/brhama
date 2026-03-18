import { scanYields, getBestYield, shouldMove } from "./yieldScanner";
import { AaveDepositor } from "./aaveDepositor";
import { YieldBridge } from "./yieldBridge";
import { getYieldDecision } from "./yieldLlm";
import { YIELD_CHAINS, MIN_APY_DIFF_TO_MOVE } from "../shared/config";
import { privateKeyToAccount } from "viem/accounts";
import {
  encodeFunctionData,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { base, arbitrum, optimism, polygon } from "viem/chains";
import type { Chain } from "viem";
import type { YieldAgentState, LogEntry, YieldPool, ChainBalance } from "@/types";
import { AAVE_V3_POOL_ABI, ERC20_ABI } from "../abi/aaveV3Pool";
import { erc7710WalletActions } from "@metamask/smart-accounts-kit/actions";

// ── Chain map for delegation execution ──
const CHAIN_MAP: Record<number, Chain> = {
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
};

let state: YieldAgentState = {
  status: "IDLE",
  mode: "DRY_RUN",
  currentPosition: null,
  lastScan: 0,
  lastYields: [],
  bestYield: null,
  logs: [],
  uptime: 0,
  scansPerformed: 0,
  movesPerformed: 0,
  moveHistory: [],
  simulatedMoves: [],
  liveMoves: [],
  walletBalances: {},
  totalBalance: "0",
  allocatedAmount: "0",
  agentAddress: "",
};

let agentPrivateKey: string | null = null;
let lastBalanceRefresh = 0;
const BALANCE_REFRESH_INTERVAL = 120_000;

// ── ERC-7715 Permission state (module level — accessible everywhere) ──
let activePermissionContext: `0x${string}` | null = null;
let activeDelegationManager: string | null = null;
let userSmartAccountAddress: `0x${string}` | null = null;

async function refreshBalances() {
  if (Date.now() - lastBalanceRefresh < BALANCE_REFRESH_INTERVAL) return;
  lastBalanceRefresh = Date.now();
  if (!agentPrivateKey) return;
  const balances: Record<number, ChainBalance> = {};
  let total = 0n;
  for (const chainId of Object.keys(YIELD_CHAINS).map(Number)) {
    try {
      const dep = new AaveDepositor(agentPrivateKey, chainId);
      const usdc = await dep.getUsdcBalance();
      const aToken = await dep.getATokenBalance();
      const chainTotal = usdc + aToken;
      balances[chainId] = {
        usdc: usdc.toString(),
        aToken: aToken.toString(),
        total: chainTotal.toString(),
      };
      total += chainTotal;
    } catch {
      balances[chainId] = { usdc: "0", aToken: "0", total: "0" };
    }
  }
  state.walletBalances = balances;
  state.totalBalance = total.toString();
}

let interval: ReturnType<typeof setInterval> | null = null;

function addLog(entry: Omit<LogEntry, "id">) {
  const log: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...entry,
  };
  state.logs = [log, ...state.logs].slice(0, 200);
}

// ── Public API ──

export function getYieldAgentState(): YieldAgentState {
  return {
    ...state,
    hasDelegation: !!activePermissionContext,
    delegationVaultAddress: userSmartAccountAddress ?? "",
  };
}

// ── ERC-7715 store/clear ──

export function storeDelegation(data: {
  permissionContext?: string;
  delegationManager?: string;
  smartAccountAddress: `0x${string}`;
  type?: "erc7715" | "erc7710";
}) {
  userSmartAccountAddress = data.smartAccountAddress;

if (data.type === "erc7715" && data.permissionContext) {
  activePermissionContext = data.permissionContext as `0x${string}`; // ← cast
  activeDelegationManager = data.delegationManager ?? null;
    addLog({
      timestamp: Date.now(),
      level: "SUCCESS",
      message: `ERC-7715 permission stored — agent executes from ${data.smartAccountAddress.slice(0, 10)}... No fund movement needed.`,
    });
  }
}

export function clearDelegation() {
  activePermissionContext = null;
  activeDelegationManager = null;
  userSmartAccountAddress = null;
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: "Permission cleared — reverting to agent wallet execution",
  });
}

export function getActiveDelegation() {
  return {
    permissionContext: activePermissionContext,
    delegationManager: activeDelegationManager,
    smartAccountAddress: userSmartAccountAddress,
  };
}

export function resetYieldAgent() {
  if (interval) clearInterval(interval);
  interval = null;
  state = {
    status: "IDLE",
    mode: state.mode,
    currentPosition: null,
    lastScan: 0,
    lastYields: [],
    bestYield: null,
    logs: [],
    uptime: 0,
    scansPerformed: 0,
    movesPerformed: 0,
    moveHistory: [],
    simulatedMoves: [],
    liveMoves: [],
    walletBalances: state.walletBalances,
    totalBalance: state.totalBalance,
    allocatedAmount: state.allocatedAmount,
    agentAddress: state.agentAddress,
  };
}

export function setAllocation(amountUsdc: string) {
  const raw = BigInt(Math.round(parseFloat(amountUsdc) * 1_000_000)).toString();
  state.allocatedAmount = raw;
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `Allocation set to ${parseFloat(amountUsdc).toFixed(4)} USDC`,
  });
}

export async function fetchAgentBalances() {
  lastBalanceRefresh = 0;
  await refreshBalances();
}

export function setYieldMode(mode: "DRY_RUN" | "LIVE") {
  state.mode = mode;
  addLog({
    timestamp: Date.now(),
    level: "WARN",
    message: `Mode switched to ${mode}${mode === "LIVE" ? " — real transactions enabled" : ""}`,
  });
}

// ── ERC-7715 Redemption Helper ──
// Agent signs and sends redeemDelegations() to DelegationManager.
// Funds move FROM the user's MetaMask wallet via the granted permission.

async function executeViaDelegation(
  chainId: number,
  targetContract: `0x${string}`,
  callData: `0x${string}`,
  label: string,
  privateKey: string
): Promise<`0x${string}`> {
  const chain = CHAIN_MAP[chainId];
  if (!chain) throw new Error(`No chain config for chainId ${chainId}`);
  if (!activePermissionContext) throw new Error("No active ERC-7715 permission");
  if (!activeDelegationManager) throw new Error("No delegation manager address");

  const agentAccount = privateKeyToAccount(
    (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`
  );

  const chainConfig = YIELD_CHAINS[chainId];

  // Extend wallet client with ERC-7710 actions for sendTransactionWithDelegation
  const walletCl = createWalletClient({
    account: agentAccount,
    chain,
    transport: http(chainConfig.txRpcUrl),
  }).extend(erc7710WalletActions());

  const publicCl = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl),
  });

  // Fix: account is required by sendTransactionWithDelegation
  const txHash = await walletCl.sendTransactionWithDelegation({
    account: agentAccount,
    to: targetContract,
    data: callData,
    chain,
    permissionsContext: activePermissionContext, // note: with 's'
    delegationManager: activeDelegationManager as `0x${string}`,
  });

  await publicCl.waitForTransactionReceipt({ hash: txHash });

  addLog({
    timestamp: Date.now(),
    level: "SUCCESS",
    message: `[ERC-7715] ${label}: ${txHash}`,
  });

  return txHash;
}

// ── Main Agent ──

export function startYieldAgent(config: {
  privateKey: string;
  pollIntervalMs: number;
  mode: "DRY_RUN" | "LIVE";
}) {
  if (
    state.status === "SCANNING" ||
    state.status === "BRIDGING" ||
    state.status === "DEPOSITING"
  ) {
    addLog({ timestamp: Date.now(), level: "WARN", message: "Agent already running" });
    return;
  }

  agentPrivateKey = config.privateKey;
  state.mode = config.mode;
  state.status = "MONITORING";
  state.uptime = Date.now();
  state.agentAddress = privateKeyToAccount(
    (config.privateKey.startsWith("0x")
      ? config.privateKey
      : `0x${config.privateKey}`) as `0x${string}`
  ).address;

  refreshBalances().catch(() => {});

  const account = privateKeyToAccount(
    (config.privateKey.startsWith("0x")
      ? config.privateKey
      : `0x${config.privateKey}`) as `0x${string}`
  );
  const address = account.address;

  const bridge = new YieldBridge(config.privateKey, address, (l) => addLog(l));

  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `brahma yield agent started [${config.mode}] — scanning every ${config.pollIntervalMs / 1000}s`,
  });
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `Agent wallet: ${address.slice(0, 8)}...${address.slice(-4)}`,
  });

  const runCycle = async () => {
    if (["BRIDGING", "DEPOSITING", "WITHDRAWING"].includes(state.status)) return;

    try {
      // ── SCAN ──
      state.status = "SCANNING";
      addLog({
        timestamp: Date.now(),
        level: "INFO",
        message: "Scanning USDC yields across chains...",
      });

      refreshBalances().catch(() => {});

      const yields: YieldPool[] = await scanYields();
      state.lastYields = yields;
      state.lastScan = Date.now();
      state.scansPerformed++;

      const actionableYields = yields.filter((y) => y.actionable);
      const best = getBestYield(yields);
      state.bestYield = best;

      if (!best) {
        addLog({
          timestamp: Date.now(),
          level: "WARN",
          message: "No actionable yield data from DeFiLlama",
        });
        state.status = "MONITORING";
        return;
      }

      for (const y of actionableYields) {
        const isCurrent = state.currentPosition?.chainId === y.chainId;
        const isBest = y.chainId === best.chainId;
        const tag = isCurrent ? " ← CURRENT" : isBest ? " ★ BEST" : "";
        addLog({
          timestamp: Date.now(),
          level: "INFO",
          message: `  [Aave V3] ${y.chain}: ${y.apyTotal.toFixed(2)}% APY | TVL $${(y.tvlUsd / 1e6).toFixed(1)}M${tag}`,
        });
      }

      // ── DETECT ON-CHAIN AAVE POSITION ──
      if (!state.currentPosition) {
        for (const chainId of Object.keys(YIELD_CHAINS).map(Number)) {
          try {
            const dep = new AaveDepositor(config.privateKey, chainId);
            const aToken = await dep.getATokenBalance();
            if (aToken > 1000n) {
              const pool = actionableYields.find((y) => y.chainId === chainId);
              state.currentPosition = {
                chainId,
                chainName: YIELD_CHAINS[chainId].name,
                protocol: "aave-v3",
                depositedAmount: aToken.toString(),
                currentApy: pool?.apyTotal ?? 0,
                depositTimestamp: Date.now(),
              };
              addLog({
                timestamp: Date.now(),
                level: "INFO",
                message: `Detected existing Aave position: ${(Number(aToken) / 1e6).toFixed(4)} aUSDC on ${YIELD_CHAINS[chainId].name}`,
              });
              break;
            }
          } catch { /* skip chain */ }
        }
      }

      const currentApy = state.currentPosition?.currentApy ?? 0;
      const currentChainId = state.currentPosition?.chainId ?? null;

      // ── BRIDGE QUOTE for LLM ──
      let bridgeCostForLlm = "unknown";
      if (currentChainId !== null && currentChainId !== best.chainId) {
        try {
          const stateAlloc = BigInt(state.allocatedAmount ?? "0");
          const stateTotal = BigInt(state.totalBalance ?? "0");
          const quoteAmount =
            stateAlloc > 0n ? stateAlloc : stateTotal > 0n ? stateTotal : BigInt(1_000_000);
          const preQuote = await bridge.fetchQuoteCost(
            currentChainId,
            best.chainId,
            quoteAmount
          );
          bridgeCostForLlm = `$${preQuote.bridgeCostUsdc.toFixed(4)} USDC via ${preQuote.bridgeName}`;
          addLog({
            timestamp: Date.now(),
            level: "INFO",
            message: `Bridge cost estimate: ${bridgeCostForLlm}`,
          });
        } catch {
          addLog({
            timestamp: Date.now(),
            level: "WARN",
            message: "Could not fetch bridge quote — LLM will decide without cost data",
          });
        }
      }

      // ── DECIDE ──
      state.status = "DECIDING";
      addLog({
        timestamp: Date.now(),
        level: "INFO",
        message: "Consulting AI decision engine...",
      });

      const decision = await getYieldDecision(
        state.currentPosition,
        actionableYields,
        bridgeCostForLlm
      );

      addLog({
        timestamp: Date.now(),
        level: decision.action === "MOVE" ? "WARN" : "INFO",
        message: `AI Decision: ${decision.action} → ${YIELD_CHAINS[decision.targetChainId]?.name ?? "?"} (${decision.confidence}%) — ${decision.reason}`,
      });

      if (decision.action === "STAY") {
        state.status = "MONITORING";
        return;
      }

      const targetChain = YIELD_CHAINS[decision.targetChainId];
      if (!targetChain) {
        addLog({
          timestamp: Date.now(),
          level: "ERROR",
          message: `Unknown target chain: ${decision.targetChainId}`,
        });
        state.status = "MONITORING";
        return;
      }

      const dryRun = state.mode === "DRY_RUN";

      // ── WITHDRAW ──
      let availableAmount: bigint;
      let sourceChainId: number = currentChainId ?? 8453;
      const allocated = BigInt(state.allocatedAmount ?? "0");
      const DRY_RUN_DEMO_AMOUNT = allocated > 0n ? allocated : 1_000_000n;
      let withdrawTxHash: string | undefined;

      if (
        state.currentPosition &&
        state.currentPosition.chainId !== decision.targetChainId
      ) {
        sourceChainId = state.currentPosition.chainId;
        state.status = "WITHDRAWING";
        const depositor = new AaveDepositor(
          config.privateKey,
          sourceChainId,
          (l) => addLog(l)
        );
        const withdrawResult = await depositor.withdraw(dryRun);
        withdrawTxHash = withdrawResult.txHash;
        availableAmount = withdrawResult.amountReceived;
        if (dryRun && availableAmount === 0n) {
          availableAmount = DRY_RUN_DEMO_AMOUNT;
          addLog({
            timestamp: Date.now(),
            level: "INFO",
            message: "[DRY RUN] No aToken balance — simulating with 1.0000 USDC",
          });
        }
      } else {
        if (currentChainId === null) {
          const hasBalanceData = Object.values(state.walletBalances).some(
            (b) => BigInt(b.total ?? "0") > 0n
          );
          if (!hasBalanceData) {
            addLog({
              timestamp: Date.now(),
              level: "INFO",
              message: "Fetching balances before first move...",
            });
            await refreshBalances();
            lastBalanceRefresh = Date.now();
          }

          let maxBalance = 0n;
          for (const [cid, bal] of Object.entries(state.walletBalances)) {
            const total = BigInt(bal.total ?? "0");
            if (total > maxBalance) {
              maxBalance = total;
              sourceChainId = Number(cid);
            }
          }
          if (maxBalance === 0n) {
            addLog({
              timestamp: Date.now(),
              level: "WARN",
              message: "No USDC balance found — depositing to best yield chain directly",
            });
            sourceChainId = decision.targetChainId;
          }
        }
        const depositor = new AaveDepositor(
          config.privateKey,
          sourceChainId,
          (l) => addLog(l)
        );
        const rawBalance = await depositor.getUsdcBalance();
        availableAmount =
          allocated > 0n && rawBalance > allocated ? allocated : rawBalance;
        addLog({
          timestamp: Date.now(),
          level: "INFO",
          message: `USDC balance on ${YIELD_CHAINS[sourceChainId]?.name}: ${(Number(rawBalance) / 1e6).toFixed(4)}${allocated > 0n ? ` (allocated: ${(Number(allocated) / 1e6).toFixed(4)})` : ""}`,
        });
        if (dryRun && availableAmount === 0n) {
          availableAmount = DRY_RUN_DEMO_AMOUNT;
          addLog({
            timestamp: Date.now(),
            level: "INFO",
            message: "[DRY RUN] No balance — simulating with 1.0000 USDC demo amount",
          });
        }
      }

      if (availableAmount === 0n) {
        addLog({
          timestamp: Date.now(),
          level: "ERROR",
          message: "No USDC available to move (switch to DRY RUN to simulate)",
        });
        state.status = "MONITORING";
        return;
      }

      // ── BRIDGE (if cross-chain) ──
      const fromChainId = state.currentPosition?.chainId ?? sourceChainId;
      let bridgeRoute;

      if (fromChainId !== decision.targetChainId) {
        state.status = "BRIDGING";

        if (dryRun) {
          const quote = await bridge.getDryRunQuote(
            fromChainId,
            decision.targetChainId,
            availableAmount
          );
          addLog({
            timestamp: Date.now(),
            level: "SUCCESS",
            message: `[DRY RUN] Would bridge via ${quote.bridgeName} — est. output: ${(Number(quote.estimatedOutput) / 1e6).toFixed(4)} USDC | fee: ${quote.bridgeCostUsdc.toFixed(4)} USDC`,
          });
          bridgeRoute = {
            fromChainId,
            toChainId: decision.targetChainId,
            fromToken: YIELD_CHAINS[fromChainId].usdc,
            toToken: targetChain.usdc,
            fromAmount: availableAmount.toString(),
            estimatedOutput: quote.estimatedOutput,
            bridgeUsed: quote.bridgeName,
            executionTime: 0,
          };
        } else {
          bridgeRoute = await bridge.executeBridge(
            fromChainId,
            decision.targetChainId,
            availableAmount
          );
        }
      }

      // ── DEPOSIT ──
      state.status = "DEPOSITING";

      let depositAmount: bigint;
      if (dryRun) {
        depositAmount = availableAmount;
      } else {
        const targetDepositor = new AaveDepositor(
          config.privateKey,
          decision.targetChainId,
          (l) => addLog(l)
        );
        depositAmount = await targetDepositor.getUsdcBalance();
        if (depositAmount === 0n) {
          addLog({
            timestamp: Date.now(),
            level: "ERROR",
            message: `Bridge completed but no USDC found on ${targetChain.name} — aborting deposit.`,
          });
          state.status = "MONITORING";
          return;
        }
        addLog({
          timestamp: Date.now(),
          level: "SUCCESS",
          message: `Confirmed ${(Number(depositAmount) / 1e6).toFixed(4)} USDC arrived on ${targetChain.name}`,
        });
      }

      if (depositAmount > 0n) {
        // ── ERC-7715 DELEGATION PATH — funds move from user's MetaMask wallet ──
        if (activePermissionContext && userSmartAccountAddress && !dryRun) {
          addLog({
            timestamp: Date.now(),
            level: "INFO",
            message: `Using ERC-7715 permission — executing from user wallet ${userSmartAccountAddress.slice(0, 10)}...`,
          });

          try {
            // Step 1: approve USDC to Aave pool via permission
            const approveCalldata = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [targetChain.aavePool, depositAmount],
            });

            await executeViaDelegation(
              decision.targetChainId,
              targetChain.usdc,
              approveCalldata,
              "Approve USDC → Aave",
              config.privateKey
            );

            // Step 2: supply to Aave via permission
            const supplyCalldata = encodeFunctionData({
              abi: AAVE_V3_POOL_ABI,
              functionName: "supply",
              args: [targetChain.usdc, depositAmount, userSmartAccountAddress, 0],
            });

            const supplyTxHash = await executeViaDelegation(
              decision.targetChainId,
              targetChain.aavePool,
              supplyCalldata,
              "Supply USDC → Aave V3",
              config.privateKey
            );

            state.currentPosition = {
              chainId: decision.targetChainId,
              chainName: targetChain.name,
              protocol: "aave-v3",
              depositedAmount: depositAmount.toString(),
              currentApy: best.apyTotal,
              depositTxHash: supplyTxHash,
              depositTimestamp: Date.now(),
            };

            addLog({
              timestamp: Date.now(),
              level: "SUCCESS",
              message: `✅ Deposited ${(Number(depositAmount) / 1e6).toFixed(4)} USDC via ERC-7715 — funds from user's MetaMask wallet`,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog({
              timestamp: Date.now(),
              level: "ERROR",
              message: `ERC-7715 redemption failed: ${msg.slice(0, 120)}`,
            });
            addLog({
              timestamp: Date.now(),
              level: "WARN",
              message: "Falling back to agent wallet execution...",
            });

            // Fallback to normal agent wallet deposit
            const targetDepositor = new AaveDepositor(
              config.privateKey,
              decision.targetChainId,
              (l) => addLog(l)
            );
            try {
              const depositResult = await targetDepositor.deposit(depositAmount, false);
              if (depositResult.txHash) {
                state.currentPosition = {
                  chainId: decision.targetChainId,
                  chainName: targetChain.name,
                  protocol: "aave-v3",
                  depositedAmount: depositAmount.toString(),
                  currentApy: best.apyTotal,
                  depositTxHash: depositResult.txHash,
                  depositTimestamp: Date.now(),
                };
              }
            } catch (fe) {
              const fm = fe instanceof Error ? fe.message : String(fe);
              addLog({
                timestamp: Date.now(),
                level: "ERROR",
                message: `Fallback deposit also failed: ${fm.slice(0, 120)}`,
              });
            }
          }

        } else {
          // ── NORMAL PATH — funds move from agent wallet ──
          if (dryRun) {
            addLog({
              timestamp: Date.now(),
              level: "INFO",
              message: `[DRY RUN] Would deposit ${(Number(depositAmount) / 1e6).toFixed(4)} USDC to Aave on ${targetChain.name}`,
            });
            const targetDepositor = new AaveDepositor(
              config.privateKey,
              decision.targetChainId,
              (l) => addLog(l)
            );
            try {
              const depositResult = await targetDepositor.deposit(depositAmount, true);
              if (depositResult.simulated) {
                state.currentPosition = {
                  chainId: decision.targetChainId,
                  chainName: targetChain.name,
                  protocol: "aave-v3",
                  depositedAmount: depositAmount.toString(),
                  currentApy: best.apyTotal,
                  depositTimestamp: Date.now(),
                };
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              addLog({
                timestamp: Date.now(),
                level: "WARN",
                message: `Dry run simulation warning: ${msg.slice(0, 80)}`,
              });
            }
          } else {
            const targetDepositor = new AaveDepositor(
              config.privateKey,
              decision.targetChainId,
              (l) => addLog(l)
            );
            try {
              const depositResult = await targetDepositor.deposit(depositAmount, false);
              if (depositResult.txHash || depositResult.simulated) {
                state.currentPosition = {
                  chainId: decision.targetChainId,
                  chainName: targetChain.name,
                  protocol: "aave-v3",
                  depositedAmount: depositAmount.toString(),
                  currentApy: best.apyTotal,
                  depositTxHash: depositResult.txHash,
                  depositTimestamp: Date.now(),
                };
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              addLog({
                timestamp: Date.now(),
                level: "ERROR",
                message: `Deposit failed: ${msg.slice(0, 120)}`,
              });
            }
          }
        }
      }

      // ── RECORD ──
      state.movesPerformed++;
      const moveRecord = {
        success: true,
        fromChain: fromChainId,
        toChain: decision.targetChainId,
        amountMoved: availableAmount.toString(),
        bridgeRoute,
        withdrawTxHash,
        depositTxHash: state.currentPosition?.depositTxHash,
        newApy: best.apyTotal,
        timestamp: Date.now(),
        dryRun,
      };
      state.moveHistory.push(moveRecord);
      if (dryRun) {
        state.simulatedMoves.push(moveRecord);
      } else {
        state.liveMoves.push(moveRecord);
      }

      addLog({
        timestamp: Date.now(),
        level: "SUCCESS",
        message: `${dryRun ? "[DRY RUN] " : ""}=== Move complete → ${targetChain.name} at ${best.apyTotal.toFixed(2)}% APY ===`,
      });

      state.status = "MONITORING";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      addLog({
        timestamp: Date.now(),
        level: "ERROR",
        message: message.slice(0, 200),
      });
      state.status = "MONITORING";
    }
  };

  runCycle();
  interval = setInterval(runCycle, config.pollIntervalMs);
}

export function stopYieldAgent() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  state.status = "PAUSED";
  addLog({ timestamp: Date.now(), level: "INFO", message: "Yield agent stopped" });
}