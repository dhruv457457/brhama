import { scanYields, getBestYield } from "./yieldScanner";
import { AaveDepositor } from "./aaveDepositor";
import { YieldBridge } from "./yieldBridge";
import { getYieldDecision } from "./yieldLlm";
import { YIELD_CHAINS } from "../shared/config";
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

const ALCHEMY_KEY = process.env.ALCHEMY_KEY;
if (!ALCHEMY_KEY) throw new Error("Missing env var: ALCHEMY_KEY");

// ── Chain map ──
const CHAIN_MAP: Record<number, Chain> = {
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
};

// ── Public RPCs ──
const PUBLIC_RPC: Record<number, string> = {
  8453: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  137: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
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

// ── ERC-7715 Permission state — per chain ──
let activePermissions: Record<number, {
  context: `0x${string}`;
  delegationManager: string;
}> = {};
let userSmartAccountAddress: `0x${string}` | null = null;

// ── Helper: are permissions currently active? ──
function hasActivePermissions(): boolean {
  return Object.keys(activePermissions).length > 0 && !!userSmartAccountAddress;
}

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
    hasDelegation: hasActivePermissions(),
    delegationVaultAddress: userSmartAccountAddress ?? "",
  };
}

export function storeDelegation(data: {
  permissions?: Record<number, { context: string; delegationManager: string; chainId: number }>;
  permissionContext?: string;
  delegationManager?: string;
  smartAccountAddress: `0x${string}`;
  type?: string;
}) {
  userSmartAccountAddress = data.smartAccountAddress;

  if (data.type === "erc7715-multi" && data.permissions) {
    activePermissions = {};
    for (const [chainId, perm] of Object.entries(data.permissions)) {
      if (chainId === "userAddress") continue;
      activePermissions[Number(chainId)] = {
        context: perm.context as `0x${string}`,
        delegationManager: perm.delegationManager,
      };
    }
    const chains = Object.keys(activePermissions).join(", ");
    addLog({
      timestamp: Date.now(),
      level: "SUCCESS",
      message: `ERC-7715 permissions stored for chains: ${chains}`,
    });
  } else if (data.permissionContext) {
    activePermissions[8453] = {
      context: data.permissionContext as `0x${string}`,
      delegationManager: data.delegationManager ?? "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3",
    };
  }

  // Permissions are meaningless in DRY_RUN — auto-switch to LIVE.
  // ERC-7715 always operates on real user funds; there is no simulation path for it.
  if (hasActivePermissions() && state.mode === "DRY_RUN") {
    state.mode = "LIVE";
    addLog({
      timestamp: Date.now(),
      level: "WARN",
      message: "ERC-7715 permissions active — switched to LIVE mode. Agent will use YOUR MetaMask wallet funds.",
    });
  }
}

export function clearDelegation() {
  activePermissions = {};
  userSmartAccountAddress = null;
  addLog({ timestamp: Date.now(), level: "INFO", message: "Permissions cleared" });
}

export function getActiveDelegation() {
  return { activePermissions, smartAccountAddress: userSmartAccountAddress };
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
  // Block switching back to DRY_RUN while permissions are live.
  if (mode === "DRY_RUN" && hasActivePermissions()) {
    addLog({
      timestamp: Date.now(),
      level: "WARN",
      message: "Cannot switch to SIMULATION while ERC-7715 permissions are active — revoke them first.",
    });
    return;
  }
  state.mode = mode;
  addLog({
    timestamp: Date.now(),
    level: "WARN",
    message: `Mode switched to ${mode}${mode === "LIVE" ? " — real transactions enabled" : ""}`,
  });
}

// ── ERC-7715 Execution Helper ──
//
// The AGENT's private key signs the delegation execution call.
// The DELEGATION MANAGER contract verifies the permission context and
// pulls USDC from the USER's wallet — the agent's own USDC is never touched.
//
// Since we no longer bridge, only approve + supply txs go through here.
// Both are cheap: ~60k gas (approve) + ~200k gas (supply) = ~0.0001 ETH on L2s.
const MIN_GAS_BALANCE_WEI = 500_000_000_000_000n; // 0.0005 ETH — sufficient for approve+supply only

const NATIVE_SYMBOL: Record<number, string> = {
  8453: "ETH",
  42161: "ETH",
  10: "ETH",
  137: "POL",
};

async function assertAgentHasGas(
  chainId: number,
  agentAddress: `0x${string}`,
  publicCl: ReturnType<typeof createPublicClient>,
): Promise<void> {
  const chainConfig = YIELD_CHAINS[chainId];
  const symbol = NATIVE_SYMBOL[chainId] ?? "ETH";
  let balance: bigint;

  try {
    balance = await publicCl.getBalance({ address: agentAddress });
  } catch {
    // If balance check itself fails (RPC issue), let the tx attempt proceed
    return;
  }

  if (balance < MIN_GAS_BALANCE_WEI) {
    const have = (Number(balance) / 1e18).toFixed(6);
    const need = (Number(MIN_GAS_BALANCE_WEI) / 1e18).toFixed(4);
    throw new Error(
      `Agent wallet ${agentAddress.slice(0, 8)}...${agentAddress.slice(-4)} needs ${symbol} on ${chainConfig.name}. ` +
      `Has ${have} ${symbol}, needs ≥ ${need} ${symbol}. ` +
      `Fund the agent wallet — your USDC always comes from YOUR MetaMask, this is only for gas.`
    );
  }

  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `[ERC-7715] Agent gas OK on ${chainConfig.name}: ${(Number(balance) / 1e18).toFixed(6)} ${symbol}`,
  });
}

async function executeViaDelegation(
  chainId: number,
  targetContract: `0x${string}`,
  callData: `0x${string}`,
  label: string,
  privateKey: string,
): Promise<`0x${string}`> {
  const chain = CHAIN_MAP[chainId];
  if (!chain) throw new Error(`No chain config for chainId ${chainId}`);

  const perm = activePermissions[chainId];
  if (!perm) {
    throw new Error(
      `No ERC-7715 permission for chain ${chainId}. ` +
      `Available: [${Object.keys(activePermissions).join(", ")}]. ` +
      `Revoke and re-grant permissions from the UI.`
    );
  }

  const agentAccount = privateKeyToAccount(
    (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`
  );

  const chainConfig = YIELD_CHAINS[chainId];

  const publicCl = createPublicClient({
    chain,
    transport: http(PUBLIC_RPC[chainId] ?? chainConfig.rpcUrl),
  });

  // Gas pre-flight check
  await assertAgentHasGas(chainId, agentAccount.address, publicCl);

  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `[ERC-7715] "${label}" — delegationManager: ${perm.delegationManager.slice(0, 10)}... context: ${perm.context.slice(0, 14)}...`,
  });

  const walletCl = createWalletClient({
    account: agentAccount,
    chain,
    transport: http(PUBLIC_RPC[chainId] ?? chainConfig.rpcUrl),
  }).extend(erc7710WalletActions());

  // Gas limits: approve ~60k, supply ~200k — add 30% buffer
  const FALLBACK_GAS: Record<string, bigint> = {
    approve: 80_000n,
    supply: 260_000n,
  };

  const fallback =
    label.toLowerCase().includes("approve") ? FALLBACK_GAS.approve :
      label.toLowerCase().includes("supply") ? FALLBACK_GAS.supply :
        200_000n;

  let gasLimit = fallback;
  try {
    const est = await publicCl.estimateGas({
      account: agentAccount,
      to: targetContract,
      data: callData,
    });
    gasLimit = (est * 130n) / 100n; // 30% buffer for delegation overhead
    addLog({
      timestamp: Date.now(),
      level: "INFO",
      message: `[ERC-7715] "${label}" gas: ${est.toLocaleString()} est → ${gasLimit.toLocaleString()} with buffer`,
    });
  } catch {
    addLog({
      timestamp: Date.now(),
      level: "WARN",
      message: `[ERC-7715] "${label}" gas estimation failed — using fallback: ${fallback.toLocaleString()} units`,
    });
  }

  const txHash = await walletCl.sendTransactionWithDelegation({
    account: agentAccount,
    to: targetContract,
    data: callData,
    gas: gasLimit,
    chain,
    permissionsContext: perm.context,
    delegationManager: perm.delegationManager as `0x${string}`,
  });

  await publicCl.waitForTransactionReceipt({ hash: txHash });

  addLog({
    timestamp: Date.now(),
    level: "SUCCESS",
    message: `[ERC-7715] ${label} ✅  tx: ${txHash}`,
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

  // If permissions were stored before the agent started, boot into LIVE mode.
  if (hasActivePermissions()) {
    state.mode = "LIVE";
  } else {
    state.mode = config.mode;
  }

  state.status = "MONITORING";
  state.uptime = Date.now();
  state.agentAddress = privateKeyToAccount(
    (config.privateKey.startsWith("0x")
      ? config.privateKey
      : `0x${config.privateKey}`) as `0x${string}`
  ).address;

  refreshBalances().catch(() => { });

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
    message: `brahma yield agent started [${state.mode}] — scanning every ${config.pollIntervalMs / 1000}s`,
  });
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `Agent wallet: ${address.slice(0, 8)}...${address.slice(-4)}`,
  });

  if (hasActivePermissions()) {
    addLog({
      timestamp: Date.now(),
      level: "SUCCESS",
      message: `[ERC-7715] Active for user ${userSmartAccountAddress?.slice(0, 10)}... — deposits on whichever chain user has USDC (no bridging)`,
    });

    // Startup gas check per chain
    ; (async () => {
      for (const chainId of Object.keys(activePermissions).map(Number)) {
        const chainConfig = YIELD_CHAINS[chainId];
        const chain = CHAIN_MAP[chainId];
        if (!chainConfig || !chain) continue;
        try {
          const publicCl = createPublicClient({
            chain,
            transport: http(PUBLIC_RPC[chainId] ?? chainConfig.rpcUrl),
          });
          const bal = await publicCl.getBalance({ address: address as `0x${string}` });
          const sym = NATIVE_SYMBOL[chainId] ?? "ETH";
          if (bal < MIN_GAS_BALANCE_WEI) {
            addLog({
              timestamp: Date.now(),
              level: "ERROR",
              message:
                `⛽ NO GAS on ${chainConfig.name} — agent wallet ${address.slice(0, 8)}...${address.slice(-4)} ` +
                `has ${(Number(bal) / 1e18).toFixed(6)} ${sym}, needs ≥ ${(Number(MIN_GAS_BALANCE_WEI) / 1e18).toFixed(4)} ${sym}. ` +
                `Send ${sym} to the agent wallet on ${chainConfig.name}. ` +
                `Your USDC is untouched — this is only for gas fees.`,
            });
          } else {
            addLog({
              timestamp: Date.now(),
              level: "SUCCESS",
              message: `⛽ ${chainConfig.name}: agent gas OK — ${(Number(bal) / 1e18).toFixed(6)} ${sym}`,
            });
          }
        } catch { /* non-fatal */ }
      }
    })();
  }

  const runCycle = async () => {
    if (["BRIDGING", "DEPOSITING", "WITHDRAWING"].includes(state.status)) return;

    // Re-evaluate on every cycle — picks up permissions granted after agent started.
    const usingErc7715 = hasActivePermissions();
    const dryRun = !usingErc7715 && state.mode === "DRY_RUN";

    try {
      // ── SCAN ──
      state.status = "SCANNING";
      addLog({
        timestamp: Date.now(),
        level: "INFO",
        message: `Scanning yields... [${usingErc7715 ? "ERC-7715 — USER FUNDS" : dryRun ? "SIMULATION" : "LIVE — AGENT FUNDS"}]`,
      });

      refreshBalances().catch(() => { });

      const yields: YieldPool[] = await scanYields();
      state.lastYields = yields;
      state.lastScan = Date.now();
      state.scansPerformed++;

      const actionableYields = yields.filter((y) => y.actionable);
      const best = getBestYield(yields);
      state.bestYield = best;

      if (!best) {
        addLog({ timestamp: Date.now(), level: "WARN", message: "No actionable yield data from DeFiLlama" });
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

      // ── DETECT AGENT WALLET POSITION (skip when ERC-7715 active) ──
      if (!state.currentPosition && !usingErc7715) {
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

      const currentChainId = state.currentPosition?.chainId ?? null;

      // ── BRIDGE QUOTE for LLM (agent wallet path only) ──
      let bridgeCostForLlm = "unknown";
      if (!usingErc7715 && currentChainId !== null && currentChainId !== best.chainId) {
        try {
          const stateAlloc = BigInt(state.allocatedAmount ?? "0");
          const stateTotal = BigInt(state.totalBalance ?? "0");
          const quoteAmount = stateAlloc > 0n ? stateAlloc : stateTotal > 0n ? stateTotal : BigInt(1_000_000);
          const preQuote = await bridge.fetchQuoteCost(currentChainId, best.chainId, quoteAmount);
          bridgeCostForLlm = `$${preQuote.bridgeCostUsdc.toFixed(4)} USDC via ${preQuote.bridgeName}`;
          addLog({ timestamp: Date.now(), level: "INFO", message: `Bridge cost estimate: ${bridgeCostForLlm}` });
        } catch {
          addLog({ timestamp: Date.now(), level: "WARN", message: "Could not fetch bridge quote — LLM will decide without cost data" });
        }
      }

      // ── DECIDE ──
      state.status = "DECIDING";
      addLog({ timestamp: Date.now(), level: "INFO", message: "Consulting AI decision engine..." });

      const decision = await getYieldDecision(state.currentPosition, actionableYields, bridgeCostForLlm);

      addLog({
        timestamp: Date.now(),
        level: decision.action === "MOVE" ? "WARN" : "INFO",
        message: `AI Decision: ${decision.action} → ${YIELD_CHAINS[decision.targetChainId]?.name ?? "?"} (${decision.confidence}%) — ${decision.reason}`,
      });

      if (decision.action === "STAY") {
        state.status = "MONITORING";
        return;
      }

      const allocated = BigInt(state.allocatedAmount ?? "0");
      const DRY_RUN_DEMO_AMOUNT = allocated > 0n ? allocated : 1_000_000n;
      let withdrawTxHash: string | undefined;

      // ── SOURCE FUNDS ──
      let availableAmount: bigint;
      let sourceChainId: number = currentChainId ?? 8453;

      if (usingErc7715) {
        // ════════════════════════════════════════════════════════
        // ERC-7715 PATH — NO BRIDGING
        //
        // Scan all chains for user USDC. Pick the chain with the
        // best Aave APY among chains where the user actually has funds.
        // Deposit directly there — zero bridge, zero bridge fees.
        // ════════════════════════════════════════════════════════
        addLog({
          timestamp: Date.now(),
          level: "INFO",
          message: `[ERC-7715] Scanning user wallet ${userSmartAccountAddress!.slice(0, 10)}... for USDC across all chains`,
        });

        type ChainOption = { chainId: number; balance: bigint; apy: number; chainName: string };
        const chainOptions: ChainOption[] = [];

        for (const chainId of Object.keys(YIELD_CHAINS).map(Number)) {
          try {
            const chainConfig = YIELD_CHAINS[chainId];
            const chain = CHAIN_MAP[chainId];
            if (!chain) continue;

            const publicCl = createPublicClient({
              chain,
              transport: http(PUBLIC_RPC[chainId] ?? chainConfig.rpcUrl),
            });

            const bal = await publicCl.readContract({
              address: chainConfig.usdc,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [userSmartAccountAddress!],
            }) as bigint;

            const pool = actionableYields.find(y => y.chainId === chainId);
            const apy = pool?.apyTotal ?? 0;

            addLog({
              timestamp: Date.now(),
              level: "INFO",
              message: `[ERC-7715] ${chainConfig.name}: ${(Number(bal) / 1e6).toFixed(4)} USDC | Aave APY: ${apy.toFixed(2)}%`,
            });

            if (bal > 0n) {
              chainOptions.push({ chainId, balance: bal, apy, chainName: chainConfig.name });
            }
          } catch (e) {
            addLog({
              timestamp: Date.now(),
              level: "WARN",
              message: `[ERC-7715] Could not check ${YIELD_CHAINS[chainId]?.name}: ${e instanceof Error ? e.message.slice(0, 60) : "unknown"}`,
            });
          }
        }

        if (chainOptions.length === 0) {
          addLog({
            timestamp: Date.now(),
            level: "ERROR",
            message: "[ERC-7715] No USDC found in user wallet on any chain — top up USDC first",
          });
          state.status = "MONITORING";
          return;
        }

        // Pick chain with highest APY where user has USDC
        const best7715 = chainOptions.sort((a, b) => b.apy - a.apy)[0];

        sourceChainId = best7715.chainId;
        availableAmount = allocated > 0n && best7715.balance > allocated
          ? allocated
          : best7715.balance;

        // Override AI decision — always deposit on user's chain, no bridge
        decision.targetChainId = best7715.chainId;

        addLog({
          timestamp: Date.now(),
          level: "SUCCESS",
          message: `[ERC-7715] Best option: ${best7715.chainName} — ${best7715.apy.toFixed(2)}% APY | will deposit ${(Number(availableAmount) / 1e6).toFixed(4)} USDC`,
        });

        if (availableAmount === 0n) {
          addLog({
            timestamp: Date.now(),
            level: "ERROR",
            message: "[ERC-7715] No USDC available to deposit",
          });
          state.status = "MONITORING";
          return;
        }

      } else if (state.currentPosition && state.currentPosition.chainId !== decision.targetChainId) {
        // ── WITHDRAW from existing agent-wallet position ──
        sourceChainId = state.currentPosition.chainId;
        state.status = "WITHDRAWING";
        const depositor = new AaveDepositor(config.privateKey, sourceChainId, (l) => addLog(l));
        const withdrawResult = await depositor.withdraw(dryRun);
        withdrawTxHash = withdrawResult.txHash;
        availableAmount = withdrawResult.amountReceived;
        if (dryRun && availableAmount === 0n) {
          availableAmount = DRY_RUN_DEMO_AMOUNT;
          addLog({ timestamp: Date.now(), level: "INFO", message: "[DRY RUN] No aToken balance — simulating with 1.0000 USDC" });
        }
      } else {
        // ── FRESH DEPOSIT via agent wallet ──
        if (currentChainId === null) {
          const hasBalanceData = Object.values(state.walletBalances).some((b) => BigInt(b.total ?? "0") > 0n);
          if (!hasBalanceData) {
            addLog({ timestamp: Date.now(), level: "INFO", message: "Fetching balances before first move..." });
            await refreshBalances();
            lastBalanceRefresh = Date.now();
          }

          let maxBalance = 0n;
          for (const [cid, bal] of Object.entries(state.walletBalances)) {
            const total = BigInt(bal.total ?? "0");
            if (total > maxBalance) { maxBalance = total; sourceChainId = Number(cid); }
          }
          if (maxBalance === 0n) {
            addLog({ timestamp: Date.now(), level: "WARN", message: "No USDC balance found — depositing to best yield chain directly" });
            sourceChainId = decision.targetChainId;
          }
        }

        const depositor = new AaveDepositor(config.privateKey, sourceChainId, (l) => addLog(l));
        const rawBalance = await depositor.getUsdcBalance();
        availableAmount = allocated > 0n && rawBalance > allocated ? allocated : rawBalance;
        addLog({
          timestamp: Date.now(),
          level: "INFO",
          message: `USDC balance on ${YIELD_CHAINS[sourceChainId]?.name}: ${(Number(rawBalance) / 1e6).toFixed(4)}${allocated > 0n ? ` (allocated: ${(Number(allocated) / 1e6).toFixed(4)})` : ""}`,
        });
        if (dryRun && availableAmount === 0n) {
          availableAmount = DRY_RUN_DEMO_AMOUNT;
          addLog({ timestamp: Date.now(), level: "INFO", message: "[DRY RUN] No balance — simulating with 1.0000 USDC" });
        }
      }

      if (availableAmount === 0n) {
        addLog({ timestamp: Date.now(), level: "ERROR", message: "No USDC available to move" });
        state.status = "MONITORING";
        return;
      }

      const targetChain = YIELD_CHAINS[decision.targetChainId];
      if (!targetChain) {
        addLog({ timestamp: Date.now(), level: "ERROR", message: `Unknown target chain: ${decision.targetChainId}` });
        state.status = "MONITORING";
        return;
      }

      // ── BRIDGE (agent wallet path only — ERC-7715 never bridges) ──
      const fromChainId = state.currentPosition?.chainId ?? sourceChainId;
      let bridgeRoute;

      if (fromChainId !== decision.targetChainId && !usingErc7715) {
        state.status = "BRIDGING";

        if (dryRun) {
          const quote = await bridge.getDryRunQuote(fromChainId, decision.targetChainId, availableAmount);
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
          // Live agent wallet bridge
          bridgeRoute = await bridge.executeBridge(fromChainId, decision.targetChainId, availableAmount);
          if (!bridgeRoute) {
            addLog({ timestamp: Date.now(), level: "ERROR", message: "Bridge failed — skipping this cycle" });
            state.status = "MONITORING";
            return;
          }
        }
      }

      // ── DEPOSIT ──
      state.status = "DEPOSITING";

      let depositAmount: bigint;

      if (usingErc7715) {
        depositAmount = availableAmount;
      } else if (dryRun) {
        depositAmount = availableAmount;
      } else {
        const targetDepositor = new AaveDepositor(config.privateKey, decision.targetChainId, (l) => addLog(l));
        depositAmount = await targetDepositor.getUsdcBalance();
        if (depositAmount === 0n) {
          addLog({ timestamp: Date.now(), level: "ERROR", message: `No USDC found on ${targetChain.name} after bridge` });
          state.status = "MONITORING";
          return;
        }
        addLog({ timestamp: Date.now(), level: "SUCCESS", message: `Confirmed ${(Number(depositAmount) / 1e6).toFixed(4)} USDC on ${targetChain.name}` });
      }

      if (depositAmount > 0n) {

        if (usingErc7715) {
          // ════════════════════════════════════════════════════════
          // ERC-7715 DEPOSIT
          // Two txs: approve + supply, both on the SAME chain.
          // No bridging. User pays gas via agent wallet delegation.
          // aUSDC is minted directly to the user's address.
          // ════════════════════════════════════════════════════════
          addLog({
            timestamp: Date.now(),
            level: "INFO",
            message: `[ERC-7715] Depositing ${(Number(depositAmount) / 1e6).toFixed(4)} USDC from user ${userSmartAccountAddress!.slice(0, 10)}... → Aave V3 on ${targetChain.name}`,
          });

          try {
            // Step 1: Approve USDC → Aave Pool
            const approveCalldata = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [targetChain.aavePool, depositAmount],
            });

            await executeViaDelegation(
              decision.targetChainId,
              targetChain.usdc,
              approveCalldata,
              `Approve ${(Number(depositAmount) / 1e6).toFixed(4)} USDC → Aave Pool`,
              config.privateKey
            );

            // Step 2: Supply to Aave — aUSDC minted to USER, not agent
            const supplyCalldata = encodeFunctionData({
              abi: AAVE_V3_POOL_ABI,
              functionName: "supply",
              args: [targetChain.usdc, depositAmount, userSmartAccountAddress!, 0],
            });

            const supplyTxHash = await executeViaDelegation(
              decision.targetChainId,
              targetChain.aavePool,
              supplyCalldata,
              `Supply ${(Number(depositAmount) / 1e6).toFixed(4)} USDC → Aave V3 (receipt: user)`,
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
              message: `✅ [ERC-7715] ${(Number(depositAmount) / 1e6).toFixed(4)} USDC deposited → Aave V3 on ${targetChain.name}. aUSDC minted to ${userSmartAccountAddress!.slice(0, 10)}...`,
            });

          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog({ timestamp: Date.now(), level: "ERROR", message: `[ERC-7715] Deposit failed: ${msg.slice(0, 200)}` });
          }

        } else if (dryRun) {
          addLog({
            timestamp: Date.now(),
            level: "INFO",
            message: `[DRY RUN] Would deposit ${(Number(depositAmount) / 1e6).toFixed(4)} USDC to Aave on ${targetChain.name}`,
          });
          try {
            const targetDepositor = new AaveDepositor(config.privateKey, decision.targetChainId, (l) => addLog(l));
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
            const msg = e instanceof Error ? e.message.slice(0, 80) : String(e);
            addLog({ timestamp: Date.now(), level: "WARN", message: `Dry run simulation warning: ${msg}` });
          }

        } else {
          // Normal agent wallet deposit
          try {
            const targetDepositor = new AaveDepositor(config.privateKey, decision.targetChainId, (l) => addLog(l));
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
            addLog({ timestamp: Date.now(), level: "ERROR", message: `Deposit failed: ${msg.slice(0, 120)}` });
          }
        }
      }

      // ── RECORD ──
      state.movesPerformed++;
      const isDryRunRecord = dryRun && !usingErc7715;
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
        dryRun: isDryRunRecord,
      };
      state.moveHistory.push(moveRecord);
      if (isDryRunRecord) {
        state.simulatedMoves.push(moveRecord);
      } else {
        state.liveMoves.push(moveRecord);
      }

      addLog({
        timestamp: Date.now(),
        level: "SUCCESS",
        message: `${usingErc7715 ? "[ERC-7715] " : isDryRunRecord ? "[DRY RUN] " : ""}=== Move complete → ${targetChain.name} at ${best.apyTotal.toFixed(2)}% APY ===`,
      });

      state.status = "MONITORING";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      addLog({ timestamp: Date.now(), level: "ERROR", message: message.slice(0, 200) });
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