"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  agent: string;
  role: "ceo" | "researcher" | "coder" | "reviewer" | "executor" | "system";
  message: string;
  timestamp: number;
  type?: "hire" | "fund" | "work" | "score" | "pay" | "fire" | "revoke" | "info";
}

interface AgentChatProps {
  economyLog: Array<{ event: string; [key: string]: any }>;
  agents: Array<{ role: string; status: string; quality_score: number; paid_amount: number; budget: number; task: string }>;
  isRunning: boolean;
  currentStep?: string;
}

function economyLogToChat(events: Array<{ event: string; [key: string]: any }>): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let t = Date.now() - events.length * 800;

  for (const e of events) {
    t += 800;
    switch (e.event) {
      case "team_planned":
        messages.push({ agent: "CEO", role: "ceo", message: `Hiring ${e.agents_hired} agents. Total budget: $${e.total_allocated}.`, timestamp: t, type: "hire" });
        break;
      case "agent_funded":
        messages.push({ agent: "CEO", role: "ceo", message: `Sub-delegation created for ${e.role}: $${e.budget} USDC.`, timestamp: t, type: "fund" });
        messages.push({ agent: e.role.charAt(0).toUpperCase() + e.role.slice(1), role: e.role as ChatMessage["role"], message: `Accepted. Starting work...`, timestamp: t + 200, type: "work" });
        break;
      case "agent_fund_failed":
        messages.push({ agent: "CEO", role: "ceo", message: `Failed to fund ${e.role}: ${e.error}`, timestamp: t, type: "fire" });
        break;
      case "task_completed":
        messages.push({ agent: e.role.charAt(0).toUpperCase() + e.role.slice(1), role: e.role as ChatMessage["role"], message: `Task complete. ${e.output_length} chars output.`, timestamp: t, type: "work" });
        break;
      case "task_failed":
        messages.push({ agent: e.role.charAt(0).toUpperCase() + e.role.slice(1), role: e.role as ChatMessage["role"], message: `Task failed: ${e.error}`, timestamp: t, type: "fire" });
        break;
      case "review_completed":
        messages.push({ agent: "Reviewer", role: "reviewer", message: `Review complete. All outputs evaluated.`, timestamp: t, type: "score" });
        break;
      case "agent_paid":
        messages.push({ agent: "CEO", role: "ceo", message: `Scored ${e.role}: ${e.score}/10. Releasing $${e.paid_amount}.`, timestamp: t, type: "pay" });
        break;
      case "agent_fired":
        messages.push({ agent: "CEO", role: "ceo", message: `${e.role} scored ${e.score}/10. FIRING.`, timestamp: t, type: "fire" });
        break;
      case "payment_settled":
        messages.push({ agent: "System", role: "system", message: `On-chain: $${e.amount} USDC to ${e.role}`, timestamp: t, type: "pay" });
        break;
      case "delegation_revoked":
        messages.push({ agent: "System", role: "system", message: `Revoked: ${e.role} -- $${e.budget_recovered} recovered.`, timestamp: t, type: "revoke" });
        break;
      case "payroll_complete":
        messages.push({ agent: "CEO", role: "ceo", message: `Payroll complete. $${e.total_paid} distributed, ${e.tx_count} txs.`, timestamp: t, type: "info" });
        break;
      case "payroll_failed":
        messages.push({ agent: "System", role: "system", message: `Payroll error: ${e.error || "see logs"}`, timestamp: t, type: "fire" });
        break;
    }
  }
  return messages;
}

function getStepMessages(step: string | undefined): ChatMessage[] {
  if (!step) return [];
  const t = Date.now();
  const map: Record<string, ChatMessage> = {
    ceo_planner: { agent: "CEO", role: "ceo", message: "Analyzing task... Planning optimal team.", timestamp: t, type: "info" },
    budget_guardian: { agent: "CEO", role: "ceo", message: "Checking on-chain budget allowance...", timestamp: t, type: "info" },
    agent_spawner: { agent: "CEO", role: "ceo", message: "Creating sub-delegations for workers...", timestamp: t, type: "fund" },
    task_executor: { agent: "System", role: "system", message: "Workers executing tasks via LLM...", timestamp: t, type: "work" },
    evaluator: { agent: "CEO", role: "ceo", message: "Evaluating output. Scoring performance...", timestamp: t, type: "score" },
    payroll: { agent: "System", role: "system", message: "Executing on-chain payroll via redeemDelegation()...", timestamp: t, type: "pay" },
  };
  return map[step] ? [map[step]] : [];
}

const ROLE_COLORS: Record<string, string> = {
  ceo: "text-yellow-400/70",
  system: "text-blue-400/60",
  researcher: "text-teal-400/60",
  reviewer: "text-rose-400/60",
  coder: "text-cyan-400/60",
  executor: "text-purple-400/60",
};

export function AgentChat({ economyLog, agents, isRunning, currentStep }: AgentChatProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMessages = economyLogToChat(economyLog);
  const liveMessages = isRunning ? getStepMessages(currentStep) : [];
  const allMessages = [...chatMessages, ...liveMessages];

  useEffect(() => {
    if (allMessages.length > visibleCount) {
      const timer = setTimeout(() => {
        setVisibleCount((c) => Math.min(c + 1, allMessages.length));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [allMessages.length, visibleCount]);

  useEffect(() => {
    if (isRunning && economyLog.length === 0) setVisibleCount(0);
  }, [isRunning, economyLog.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleCount]);

  const displayMessages = allMessages.slice(0, visibleCount);

  return (
    <div className="terminal flex flex-col h-full">
      {/* Terminal title bar */}
      <div className="terminal-titlebar flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]" />
            <span className="w-[10px] h-[10px] rounded-full bg-[#febc2e]" />
            <span className="w-[10px] h-[10px] rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] text-white/30 font-mono ml-2">agent-comms</span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400/50 font-mono">live</span>
            </>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-[1.7]"
        style={{ background: "#0c0c0c" }}
      >
        {displayMessages.length === 0 && !isRunning ? (
          <div className="flex items-center gap-2 py-1">
            <span className="text-white/15">$</span>
            <span className="text-white/[0.12]">
              awaiting pipeline execution...
            </span>
            <motion.span
              className="text-white/20"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              _
            </motion.span>
          </div>
        ) : (
          <div className="space-y-0">
            <AnimatePresence>
              {displayMessages.map((msg, i) => {
                const agentColor = ROLE_COLORS[msg.role] || "text-white/40";
                const typeIndicator =
                  msg.type === "fire" || msg.type === "revoke"
                    ? "text-red-400/60"
                    : msg.type === "pay"
                      ? "text-emerald-400/60"
                      : msg.type === "fund"
                        ? "text-yellow-400/50"
                        : msg.type === "score"
                          ? "text-purple-400/50"
                          : "text-white/30";

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-0 py-0.5 hover:bg-white/[0.015] px-1 -mx-1 rounded"
                  >
                    <span className="text-white/15 w-4 flex-shrink-0 select-none">$</span>
                    <span className={`${agentColor} font-semibold w-[72px] flex-shrink-0 truncate`}>
                      {msg.agent.toLowerCase()}
                    </span>
                    <span className={`${typeIndicator} flex-1`}>
                      {msg.message}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {isRunning && (
          <div className="flex items-center gap-0 py-0.5 px-1 -mx-1 mt-1">
            <span className="text-white/15 w-4 flex-shrink-0">$</span>
            <span className="text-emerald-400/50 font-semibold w-[72px] flex-shrink-0">pact</span>
            <div className="flex items-center gap-1">
              <span className="text-white/20">processing</span>
              {[0, 1, 2].map((j) => (
                <motion.span
                  key={j}
                  className="text-white/30"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: j * 0.3 }}
                >
                  .
                </motion.span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
