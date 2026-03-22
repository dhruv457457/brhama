"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface Agent {
  role: string;
  status: string;
  quality_score: number;
  paid_amount: number;
  budget: number;
  output: string;
}

interface EconomyEvent {
  event: string;
  role?: string;
  paid_amount?: number;
  budget?: number;
  [key: string]: any;
}

interface EconomyChartsProps {
  agents: Agent[];
  totalAllocated: number;
  totalPaid: number;
  economyLog: EconomyEvent[];
}

// Simple bar chart using divs
function BarChart({ data, label, valuePrefix = "$" }: {
  data: { name: string; value: number; color: string }[];
  label: string;
  valuePrefix?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      <p className="text-[10px] text-white/20 uppercase tracking-wider font-medium mb-4">{label}</p>
      <div className="space-y-2.5">
        {data.map((item, i) => (
          <div key={item.name + i} className="flex items-center gap-3">
            <span className="text-[11px] text-white/40 w-20 truncate font-medium capitalize">
              {item.name}
            </span>
            <div className="flex-1 h-6 rounded-lg bg-white/[0.03] overflow-hidden relative">
              <motion.div
                className="h-full rounded-lg"
                style={{ background: item.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-white/40">
                {valuePrefix}{item.value.toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Donut-style chart using CSS conic-gradient
function SpendingDonut({ segments, total, center }: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  center: string;
}) {
  const gradient = useMemo(() => {
    if (segments.length === 0) return "conic-gradient(rgba(255,255,255,0.05) 0deg 360deg)";
    let current = 0;
    const stops: string[] = [];
    for (const seg of segments) {
      const pct = total > 0 ? (seg.value / total) * 100 : 0;
      stops.push(`${seg.color} ${current}% ${current + pct}%`);
      current += pct;
    }
    if (current < 100) {
      stops.push(`rgba(255,255,255,0.04) ${current}% 100%`);
    }
    return `conic-gradient(${stops.join(", ")})`;
  }, [segments, total]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-32 h-32 rounded-full relative"
        style={{ background: gradient }}
      >
        <div className="absolute inset-3 rounded-full bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-center">
            <p className="text-[18px] font-semibold text-white/80 font-mono">{center}</p>
            <p className="text-[9px] text-white/25 uppercase tracking-wider">total</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
            <span className="text-[10px] text-white/30 capitalize">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  analyst: "rgba(96, 165, 250, 0.6)",
  strategist: "rgba(167, 139, 250, 0.6)",
  engineer: "rgba(34, 211, 238, 0.6)",
  writer: "rgba(52, 211, 153, 0.6)",
  risk_officer: "rgba(251, 191, 36, 0.6)",
  reviewer: "rgba(251, 113, 133, 0.6)",
  researcher: "rgba(45, 212, 191, 0.6)",
  coder: "rgba(129, 140, 248, 0.6)",
  executor: "rgba(192, 132, 252, 0.6)",
};

function getRoleColor(role: string): string {
  const base = role.split("_")[0];
  return ROLE_COLORS[base] || "rgba(255, 255, 255, 0.3)";
}

export function EconomyCharts({ agents, totalAllocated, totalPaid, economyLog }: EconomyChartsProps) {
  const paidAgents = agents.filter((a) => a.status === "paid" || a.status === "completed");
  const firedAgents = agents.filter((a) => a.status === "fired");

  // Spending breakdown by agent
  const spendingData = agents
    .filter((a) => a.paid_amount > 0)
    .map((a) => ({
      name: a.role.replace("_", " "),
      value: a.paid_amount,
      color: getRoleColor(a.role),
    }));

  // Quality scores
  const qualityData = agents
    .filter((a) => a.quality_score > 0)
    .map((a) => ({
      name: a.role.replace("_", " "),
      value: a.quality_score,
      color: getRoleColor(a.role),
    }));

  // Budget vs Paid comparison
  const budgetCompareData = agents.map((a) => ({
    name: a.role.replace("_", " "),
    budget: a.budget,
    paid: a.paid_amount,
    color: getRoleColor(a.role),
  }));

  // Donut segments
  const donutSegments = agents
    .filter((a) => a.paid_amount > 0)
    .map((a) => ({
      label: a.role.replace("_", " "),
      value: a.paid_amount,
      color: getRoleColor(a.role),
    }));

  // Unspent segment
  const unspent = totalAllocated - totalPaid;

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
            <span className="text-[13px] text-white/55 font-mono">&#x25A8;</span>
          </div>
          <div>
            <p className="label-xs">Economy Analytics</p>
            <p className="text-[11px] text-white/15 font-mono mt-0.5">spending · quality · efficiency</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-emerald-400/50">{paidAgents.length} paid</span>
          {firedAgents.length > 0 && (
            <span className="text-red-400/50">{firedAgents.length} fired</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Donut + spending side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card-sm p-5 flex flex-col items-center justify-center">
            <p className="text-[10px] text-white/20 uppercase tracking-wider font-medium mb-3">Spending</p>
            <SpendingDonut
              segments={donutSegments}
              total={totalPaid}
              center={`$${totalPaid.toFixed(0)}`}
            />
            {unspent > 0 && (
              <p className="text-[10px] text-white/15 font-mono mt-2">
                ${unspent.toFixed(0)} unspent
              </p>
            )}
          </div>

          <div className="card-sm p-5">
            <BarChart data={qualityData} label="Quality Scores" valuePrefix="" />
          </div>
        </div>

        {/* Budget vs Actual */}
        <div className="card-sm p-5">
        <p className="text-[10px] text-white/20 uppercase tracking-wider font-medium mb-4">Budget vs Actual Pay</p>
        <div className="space-y-3">
          {budgetCompareData.map((item, i) => (
            <div key={item.name + i} className="flex items-center gap-3">
              <span className="text-[11px] text-white/40 w-20 truncate font-medium capitalize">
                {item.name}
              </span>
              <div className="flex-1 relative">
                {/* Budget bar (background) */}
                <div className="h-4 rounded-md bg-white/[0.04] overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-md absolute top-0 left-0"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.budget / (totalAllocated || 1)) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                  />
                  {/* Paid bar (foreground) */}
                  <motion.div
                    className="h-full rounded-md absolute top-0 left-0"
                    style={{ background: item.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.paid / (totalAllocated || 1)) * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.08 + 0.2 }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 w-28 justify-end">
                <span className="text-[10px] font-mono text-white/25">${item.budget}</span>
                <span className="text-[9px] text-white/10">→</span>
                <span className={`text-[10px] font-mono font-semibold ${
                  item.paid === 0 ? "text-red-400/40" : "text-emerald-400/60"
                }`}>
                  ${item.paid}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-white/[0.06]" />
              <span className="text-[10px] text-white/20">Budget</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-white/30" />
              <span className="text-[10px] text-white/20">Paid</span>
            </div>
          </div>
          <span className="text-[11px] font-mono text-white/25">
            {totalAllocated > 0 ? ((totalPaid / totalAllocated) * 100).toFixed(0) : 0}% budget used
          </span>
        </div>
      </div>
      </div>
    </motion.div>
  );
}
