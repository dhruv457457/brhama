"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AgentWorker {
  agent_id: string;
  role: string;
  task: string;
  budget: number;
  status: string;
  output: string;
  quality_score: number;
  paid_amount: number;
  wallet_address: string;
}

interface AgentCardsProps {
  agents: AgentWorker[];
  txHashes: Record<string, string>;
}

const ROLE_COLORS: Record<string, string> = {
  analyst: "rgba(96,165,250,0.12)",
  strategist: "rgba(167,139,250,0.12)",
  engineer: "rgba(34,211,238,0.12)",
  writer: "rgba(52,211,153,0.12)",
  risk_officer: "rgba(251,191,36,0.12)",
  reviewer: "rgba(251,113,133,0.12)",
  researcher: "rgba(45,212,191,0.12)",
};

function getRoleGlow(role: string): string {
  const base = role.split("_")[0];
  return ROLE_COLORS[base] || "rgba(255,255,255,0.05)";
}

export function AgentCards({ agents, txHashes }: AgentCardsProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!agents || agents.length === 0) return null;

  const paid = agents.filter((a) => a.status === "paid").length;
  const fired = agents.filter((a) => a.status === "fired").length;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="label-xs">Workforce Results</p>
        <div className="flex items-center gap-4">
          {paid > 0 && <span className="text-[12px] text-emerald-400/60 font-mono">{paid} paid</span>}
          {fired > 0 && <span className="text-[12px] text-red-400/50 font-mono">{fired} fired</span>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent, idx) => {
          const txHash = txHashes[agent.wallet_address];
          const isFired = agent.status === "fired";
          const isPaid = agent.status === "paid";
          const glow = getRoleGlow(agent.role);
          const isExpanded = expandedIdx === idx;

          return (
            <motion.div
              key={agent.agent_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isFired ? 0.35 : 1, y: 0 }}
              transition={{ delay: idx * 0.07, duration: 0.35 }}
              className="rounded-[18px] overflow-hidden cursor-pointer transition-all duration-300"
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid rgba(255,255,255,${isFired ? "0.04" : "0.08"})`,
                boxShadow: isFired ? "none" : `0 0 30px ${glow}, 0 0 60px ${glow.replace("0.12", "0.06")}`,
              }}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
                      <span className="text-[13px] font-bold text-white/60">
                        {agent.role[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className={`text-[14px] font-semibold block leading-none capitalize ${isFired ? "text-red-400/50 line-through" : "text-white/80"}`}>
                        {agent.role.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-white/25 font-mono mt-1 block">
                        {agent.wallet_address.slice(0, 10)}...
                      </span>
                    </div>
                  </div>
                  <span className={`text-[12px] font-mono font-semibold ${
                    isFired ? "text-red-400/50" : isPaid ? "text-emerald-400/70" : "text-white/40"
                  }`}>
                    {isFired ? "FIRED" : isPaid ? `$${agent.paid_amount}` : agent.status}
                  </span>
                </div>

                {/* Task */}
                <p className="text-[12px] text-white/35 mb-4 line-clamp-2 leading-[1.6]">
                  {agent.task}
                </p>

                {/* Metrics row */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-center py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="text-[9px] text-white/25 uppercase tracking-wider">Budget</div>
                    <div className="text-[15px] font-mono text-white/60 mt-0.5 font-semibold">${agent.budget}</div>
                  </div>
                  <div className="flex-1 text-center py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="text-[9px] text-white/25 uppercase tracking-wider">Score</div>
                    <div className={`text-[15px] font-mono mt-0.5 font-semibold ${
                      agent.quality_score >= 8 ? "text-white/90" :
                      agent.quality_score >= 6 ? "text-white/65" :
                      agent.quality_score >= 4 ? "text-white/40" :
                      agent.quality_score > 0 ? "text-red-400/60" : "text-white/20"
                    }`}>
                      {agent.quality_score > 0 ? `${agent.quality_score}/10` : "--"}
                    </div>
                  </div>
                  <div className="flex-1 text-center py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="text-[9px] text-white/25 uppercase tracking-wider">Paid</div>
                    <div className={`text-[15px] font-mono mt-0.5 font-semibold ${
                      isFired ? "text-red-400/45 line-through" :
                      isPaid ? "text-emerald-400/70" : "text-white/20"
                    }`}>
                      {isFired ? "$0" : agent.paid_amount > 0 ? `$${agent.paid_amount}` : "--"}
                    </div>
                  </div>
                </div>

                {/* Tx hash */}
                {txHash && (
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] font-mono text-white/30 hover:text-white/55 transition-colors flex items-center gap-1.5"
                    >
                      <span>tx: {txHash.slice(0, 10)}...{txHash.slice(-4)}</span>
                      <span className="text-[9px]">&#8599;</span>
                    </a>
                  </div>
                )}

                {/* Expandable output */}
                <AnimatePresence>
                  {isExpanded && agent.output && !isFired && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-white/[0.04]">
                        <p className="text-[10px] text-white/20 uppercase tracking-wider mb-2 font-semibold">Output</p>
                        <pre className="text-[11px] text-white/35 max-h-32 overflow-auto whitespace-pre-wrap font-mono rounded-xl p-3 leading-relaxed"
                          style={{ background: "rgba(255,255,255,0.015)" }}
                        >
                          {agent.output.slice(0, 600)}
                          {agent.output.length > 600 ? "..." : ""}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
