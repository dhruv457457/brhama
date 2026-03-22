"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentPipeline } from "@/components/dashboard/AgentPipeline";
import { DelegationTree } from "@/components/dashboard/DelegationTree";
import { AgentChat } from "@/components/dashboard/AgentChat";
import { LiveAgentPanel } from "@/components/dashboard/LiveAgentPanel";
import { PermissionManager } from "@/components/dashboard/PermissionManager";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AgentVerification } from "@/components/dashboard/AgentVerification";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useAgentStore } from "@/store/agentStore";
import { useWalletStore } from "@/store/walletStore";
import { triggerPipeline, getPipelineStatus, getHistoryRun } from "@/lib/api";
import { ONCHAIN_SERVICE_URL } from "@/lib/constants";

export default function DashboardPage() {
  const { status, result } = useAgentStore();
  const { permissionsContext, delegationManager, address } = useWalletStore();
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | undefined>();
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [budgetUsdc, setBudgetUsdc] = useState(0);
  const [loadingBudget, setLoadingBudget] = useState(true);
  const [agentSmartAccount, setAgentSmartAccount] = useState<string>("0xE6a2...849a");
  const [error, setError] = useState<string | null>(null);
  const [isRevoked, setIsRevoked] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [leftTab, setLeftTab] = useState<"pipeline" | "delegation">("pipeline");

  const fetchBudget = useCallback(async () => {
    setLoadingBudget(true);
    try {
      if (address) {
        const permRes = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/active/${address}`);
        if (permRes.ok) {
          const data = await permRes.json();
          if (data.permission?.budget) {
            setBudgetUsdc(parseFloat(data.permission.budget));
            setLoadingBudget(false);
            return;
          }
        }
      }
      if (permissionsContext) {
        const allowanceRes = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/allowance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissionsContext }),
        });
        if (allowanceRes.ok) {
          const data = await allowanceRes.json();
          setBudgetUsdc(data.remaining || 0);
        }
      }
    } catch (err) {
      console.warn("[Dashboard] Could not fetch budget:", err);
    } finally {
      setLoadingBudget(false);
    }
  }, [address, permissionsContext]);

  const fetchAgentInfo = useCallback(async () => {
    try {
      const res = await fetch(`${ONCHAIN_SERVICE_URL}/api/health`);
      if (res.ok) {
        const data = await res.json();
        if (data.agentSmartAccount) setAgentSmartAccount(data.agentSmartAccount);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchBudget();
    fetchAgentInfo();
  }, [fetchBudget, fetchAgentInfo]);

  async function handleRunPipeline() {
    if (!permissionsContext) {
      setError("No active permission. Grant ERC-7715 access first.");
      return;
    }

    setIsRevoked(false);
    setSelectedAgent(null);
    const task = taskInput.trim() || "Research the best DeFi yield farming strategies and write an analysis report";

    setIsRunning(true);
    setError(null);
    setCompletedSteps([]);
    useAgentStore.getState().setStatus("running");
    useAgentStore.getState().setResult(null);

    try {
      const { run_id } = await triggerPipeline({
        task,
        budget_usdc: budgetUsdc || 500,
        permissions_context: permissionsContext || undefined,
        delegation_manager: delegationManager || undefined,
      });
      useAgentStore.getState().setRun(run_id);

      const poll = setInterval(async () => {
        try {
          const res = await getPipelineStatus(run_id);

          if (res.current_step) setCurrentStep(res.current_step);
          if (res.completed_steps) setCompletedSteps(res.completed_steps);
          if (res.result) useAgentStore.getState().setResult(res.result);

          if (res.status === "completed") {
            useAgentStore.getState().setStatus("completed");
            clearInterval(poll);
            setCurrentStep(undefined);
            setCompletedSteps(["ceo_planner", "budget_guardian", "agent_spawner", "task_executor", "evaluator", "payroll"]);
            setIsRunning(false);
            fetchBudget();
          } else if (res.status === "failed") {
            useAgentStore.getState().setError(res.error || "Pipeline failed");
            clearInterval(poll);
            setCurrentStep(undefined);
            setIsRunning(false);
            setError(res.error || "Pipeline failed");
          }
        } catch {}
      }, 1000);

      setTimeout(() => {
        clearInterval(poll);
        if (isRunning) {
          useAgentStore.getState().setStatus("idle");
          setCurrentStep(undefined);
          setIsRunning(false);
          setError("Pipeline timed out.");
        }
      }, 180000);
    } catch {
      useAgentStore.getState().setStatus("idle");
      setCurrentStep(undefined);
      setIsRunning(false);
      setError("Could not reach agents API. Start: cd apps/agents && uvicorn main:app --port 8000");
    }
  }

  async function handleKillSwitch() {
    if (!confirm("KILL SWITCH: Revoke all permissions? Every agent loses spending power immediately.")) return;
    setIsRevoked(true);

    if (address) {
      try {
        const permRes = await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/list/${address}`);
        if (permRes.ok) {
          const data = await permRes.json();
          const activePerms = (data.permissions || []).filter((p: any) => p.status === "active");
          for (const perm of activePerms) {
            await fetch(`${ONCHAIN_SERVICE_URL}/api/permissions/revoke-stored`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ permissionId: perm.id }),
            });
          }
        }
      } catch {}
    }

    useWalletStore.getState().setPermissionsContext("");
  }

  async function handleSelectHistory(runId: string) {
    try {
      const data = await getHistoryRun(runId);
      if (data?.result) {
        useAgentStore.getState().setResult(data.result);
        useAgentStore.getState().setStatus("completed");
        setCompletedSteps(["ceo_planner", "budget_guardian", "agent_spawner", "task_executor", "evaluator", "payroll"]);
        setCurrentStep(undefined);
        setIsRunning(false);
        setTaskInput(data.task || "");
      }
    } catch {}
  }

  const agents = result?.agents || [];
  const firedAgents = agents.filter((a) => a.status === "fired");
  const hasResult = agents.length > 0;

  const recentPayments = useMemo(() => {
    if (!result?.economy_log) return [];
    return result.economy_log
      .filter((e) => e.event === "agent_paid")
      .map((e) => ({ role: e.role, amount: e.paid_amount }));
  }, [result?.economy_log]);

  return (
    <div className="h-screen flex overflow-hidden bg-[#050505]">
      {/* Sidebar */}
      <Sidebar
        isRunning={isRunning}
        currentRunId={useAgentStore.getState().currentRunId}
        onSelectHistory={handleSelectHistory}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-white/[0.06] flex items-center justify-between px-5 flex-shrink-0 bg-[#0a0a0a]/50">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-semibold text-white/80 tracking-[-0.02em]">Agent Economy</h1>
            {isRevoked ? (
              <span className="badge badge-danger">KILLED</span>
            ) : permissionsContext ? (
              <span className="badge badge-active flex items-center gap-1.5">
                <span className="relative">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 block" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 block absolute inset-0 animate-ping" />
                </span>
                ERC-7715
              </span>
            ) : (
              <span className="badge badge-warn">NO PERMISSION</span>
            )}
            {/* Stats inline */}
            <div className="hidden md:flex items-center gap-4 ml-4 text-[11px] font-mono text-white/25">
              <span>agents: <span className="text-white/50">{agents.length}</span></span>
              <span>payroll: <span className="text-emerald-400/60">${(result?.total_paid || 0).toFixed(0)}</span></span>
              <span>budget: <span className="text-white/50">${(result?.total_allocated || (loadingBudget ? 0 : budgetUsdc)).toFixed(0)}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {permissionsContext && hasResult && !isRevoked && (
              <button
                onClick={handleKillSwitch}
                className="text-[11px] text-red-400/30 hover:text-red-400 font-mono px-3 py-1.5 rounded-lg hover:bg-red-500/[0.06] transition-all"
              >
                Kill Switch
              </button>
            )}
            <ConnectButton />
          </div>
        </div>

        {/* Body: split into left panel + right workspace */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel: pipeline + delegation + permission */}
          <div className="w-[300px] border-r border-white/[0.06] flex flex-col overflow-y-auto flex-shrink-0">
            {/* Permission manager */}
            <div className="p-3 border-b border-white/[0.06]">
              <PermissionManager onPermissionChange={fetchBudget} />
            </div>

            {/* Task input */}
            <div className="p-3 border-b border-white/[0.06]">
              <div className="space-y-2">
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRunPipeline()}
                  placeholder="Describe task..."
                  className="input w-full px-3 py-2.5 text-[12px]"
                />
                <button
                  className="btn btn-primary w-full py-2.5 text-[12px]"
                  onClick={handleRunPipeline}
                  disabled={isRunning || !permissionsContext || isRevoked}
                >
                  {isRunning ? "Running..." : !permissionsContext ? "No Permission" : "Launch Economy"}
                </button>
              </div>
            </div>

            {/* Tabs: Pipeline / Delegation */}
            <div className="flex border-b border-white/[0.06]">
              {(["pipeline", "delegation"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-semibold transition-all ${
                    leftTab === tab
                      ? "text-white/60 border-b border-white/20"
                      : "text-white/20 hover:text-white/35"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3">
              {leftTab === "pipeline" ? (
                <div className="space-y-3">
                  <AgentPipeline
                    status={isRunning ? "running" : status}
                    currentStep={currentStep}
                    completedSteps={completedSteps}
                  />
                  {result?.ceo_reasoning && (
                    <div className="card p-4">
                      <p className="label-xs mb-2">CEO Reasoning</p>
                      <p className="text-[11px] text-white/35 leading-[1.7]">{result.ceo_reasoning}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <DelegationTree
                    ownerAddress={
                      address
                        ? `${address.slice(0, 6)}...${address.slice(-4)}`
                        : "Not connected"
                    }
                    ceoAddress={
                      agentSmartAccount.length > 12
                        ? `${agentSmartAccount.slice(0, 6)}...${agentSmartAccount.slice(-4)}`
                        : agentSmartAccount
                    }
                    agents={agents.map((a) => ({
                      role: a.role,
                      address:
                        a.wallet_address.length > 12
                          ? `${a.wallet_address.slice(0, 6)}...${a.wallet_address.slice(-4)}`
                          : a.wallet_address,
                      amount: a.paid_amount || a.budget,
                      status: a.status,
                    }))}
                    recentPayments={recentPayments}
                    isRevoked={isRevoked}
                  />
                  <AgentVerification agents={agents} />
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 border-t border-white/[0.06]">
                <div className="card-sm p-3 border-red-500/10 flex items-start gap-2">
                  <span className="text-[10px] text-red-400/70 font-semibold mt-0.5">!</span>
                  <p className="text-[11px] text-red-300/50 flex-1">{error}</p>
                  <button onClick={() => setError(null)} className="text-[10px] text-white/20 hover:text-white/40 font-mono">x</button>
                </div>
              </div>
            )}
          </div>

          {/* Right area: workspace (top) + terminal (bottom) */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Agent workspace */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {(isRunning || hasResult) ? (
                <>
                  <LiveAgentPanel
                    agents={agents}
                    isRunning={isRunning}
                    currentStep={currentStep}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                  />

                  {/* Selected agent output overlay */}
                  <AnimatePresence>
                    {selectedAgent !== null && agents[selectedAgent] && (
                      <motion.div
                        initial={{ opacity: 0, y: 12, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: 12, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="card-glow p-5 overflow-hidden mt-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-xl bg-white/[0.06] flex items-center justify-center">
                              <span className="text-[12px] font-bold text-white/60">
                                {agents[selectedAgent].role[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-white/80 capitalize">
                                {agents[selectedAgent].role.replace("_", " ")} Output
                              </p>
                              <p className="text-[10px] text-white/25 font-mono">
                                {agents[selectedAgent].output?.length || 0} chars --
                                score {agents[selectedAgent].quality_score}/10 --
                                paid ${agents[selectedAgent].paid_amount}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedAgent(null)}
                            className="text-[11px] text-white/20 hover:text-white/50 font-mono transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.03]"
                          >
                            close
                          </button>
                        </div>
                        <pre
                          className="text-[11px] text-white/40 max-h-52 overflow-auto whitespace-pre-wrap font-mono rounded-xl p-3 leading-[1.7]"
                          style={{ background: "rgba(255,255,255,0.015)" }}
                        >
                          {agents[selectedAgent].output || "No output yet..."}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <motion.div
                  className="h-full flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="text-center">
                    <motion.div
                      className="font-mono text-white/10 text-[16px] leading-tight whitespace-pre mb-5"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {`  [o_o]\n  /| |\\  \n   d b`}
                    </motion.div>
                    <h3 className="text-[15px] font-medium mb-2 text-white/50">Agent Workspace</h3>
                    <p className="text-[12px] text-white/20 max-w-xs mx-auto leading-[1.7]">
                      {permissionsContext
                        ? "Type a task and hit Launch. Agents will spawn here with live activity and real-time output."
                        : "Grant an ERC-7715 permission first to launch your autonomous AI economy."}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Terminal — VS Code style at bottom */}
            <div className="h-[220px] border-t border-white/[0.06] flex-shrink-0">
              <AgentChat
                economyLog={result?.economy_log || []}
                agents={agents}
                isRunning={isRunning}
                currentStep={currentStep}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
