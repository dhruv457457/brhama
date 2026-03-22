"use client";

import { motion } from "framer-motion";

interface CeoValueCardProps {
  totalAllocated: number;
  totalPaid: number;
  agentCount: number;
  firedCount: number;
  agents: Array<{
    role: string;
    status: string;
    quality_score: number;
    paid_amount: number;
    budget: number;
    output: string;
  }>;
}

export function CeoValueCard({
  totalAllocated,
  totalPaid,
  agentCount,
  firedCount,
  agents,
}: CeoValueCardProps) {
  const paidAgents = agents.filter((a) => a.status === "paid");
  const budgetSaved = totalAllocated - totalPaid;
  const savingsPercent = totalAllocated > 0 ? ((budgetSaved / totalAllocated) * 100).toFixed(0) : "0";
  const avgScore = paidAgents.length > 0
    ? (paidAgents.reduce((sum, a) => sum + a.quality_score, 0) / paidAgents.length).toFixed(1)
    : "0";
  const totalOutputChars = agents.reduce((sum, a) => sum + (a.output?.length || 0), 0);
  const costPerKChar = totalPaid > 0 && totalOutputChars > 0
    ? (totalPaid / (totalOutputChars / 1000)).toFixed(2)
    : "0";
  const efficiency = totalAllocated > 0
    ? ((totalPaid / totalAllocated) * 100).toFixed(0)
    : "0";

  // ROI estimate: quality-weighted output value
  const valueScore = paidAgents.reduce((sum, a) => sum + (a.quality_score * a.paid_amount), 0);
  const roiMultiple = totalPaid > 0 ? (valueScore / totalPaid).toFixed(1) : "0";

  return (
    <motion.div
      className="card p-7"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/[0.07] flex items-center justify-center">
            <span className="text-[13px] text-white/55 font-semibold">$</span>
          </div>
          <div>
            <p className="label-xs">CEO Performance</p>
            <p className="text-[11px] text-white/15 font-mono mt-0.5">value for money analysis</p>
          </div>
        </div>
        <div className={`badge ${
          Number(avgScore) >= 7 ? "badge-success" :
          Number(avgScore) >= 5 ? "badge-active" :
          "badge-danger"
        }`}>
          {Number(avgScore) >= 7 ? "HIGH VALUE" :
           Number(avgScore) >= 5 ? "FAIR VALUE" :
           "LOW VALUE"}
        </div>
      </div>

      {/* Big metrics row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="stat-value font-mono text-emerald-400/80">${budgetSaved.toFixed(0)}</p>
          <p className="text-[11px] text-white/25 mt-1">Budget Saved</p>
        </div>
        <div className="text-center">
          <p className="stat-value font-mono">{avgScore}<span className="text-[16px] text-white/30">/10</span></p>
          <p className="text-[11px] text-white/25 mt-1">Avg Quality</p>
        </div>
        <div className="text-center">
          <p className="stat-value font-mono">{roiMultiple}<span className="text-[16px] text-white/30">x</span></p>
          <p className="text-[11px] text-white/25 mt-1">Value Score</p>
        </div>
      </div>

      {/* Detailed metrics */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/25">Budget Efficiency</span>
            <span className="text-[13px] font-mono text-white/60 font-semibold">{efficiency}%</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white/30"
              initial={{ width: 0 }}
              animate={{ width: `${efficiency}%` }}
              transition={{ duration: 1, delay: 0.3 }}
            />
          </div>
        </div>
        <div className="card-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/25">Hire Success Rate</span>
            <span className="text-[13px] font-mono text-white/60 font-semibold">
              {agentCount > 0 ? (((agentCount - firedCount) / agentCount) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white/30"
              initial={{ width: 0 }}
              animate={{ width: `${agentCount > 0 ? ((agentCount - firedCount) / agentCount) * 100 : 0}%` }}
              transition={{ duration: 1, delay: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* Agent breakdown table */}
      <div className="card-sm p-4">
        <p className="text-[10px] text-white/20 uppercase tracking-wider font-medium mb-3">Agent Breakdown</p>
        <div className="space-y-2">
          {agents.map((agent, i) => {
            const isFired = agent.status === "fired";
            const scorePercent = agent.quality_score * 10;

            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                  <span className={`text-[9px] font-semibold ${isFired ? "text-red-400/50" : "text-white/45"}`}>
                    {agent.role[0].toUpperCase()}
                  </span>
                </div>
                <span className={`text-[12px] font-medium w-20 truncate ${isFired ? "text-red-400/35 line-through" : "text-white/50"}`}>
                  {agent.role}
                </span>
                {/* Score bar */}
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      isFired ? "bg-red-400/40" :
                      agent.quality_score >= 8 ? "bg-white/50" :
                      agent.quality_score >= 6 ? "bg-white/30" :
                      "bg-white/15"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${scorePercent}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                  />
                </div>
                <span className={`text-[12px] font-mono w-8 text-right ${isFired ? "text-red-400/35" : "text-white/40"}`}>
                  {agent.quality_score > 0 ? `${agent.quality_score}` : "--"}
                </span>
                <span className={`text-[12px] font-mono w-12 text-right ${
                  isFired ? "text-red-400/35" : "text-emerald-400/55"
                }`}>
                  {isFired ? "$0" : `$${agent.paid_amount}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary line */}
      <div className="mt-5 pt-4 border-t border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-white/20">
            {totalOutputChars.toLocaleString()} chars output
          </span>
          <span className="text-[11px] text-white/20">
            ${costPerKChar}/k chars
          </span>
        </div>
        <span className="text-[12px] text-white/35 font-mono">
          ${totalPaid} spent of ${totalAllocated} allocated
        </span>
      </div>
    </motion.div>
  );
}
