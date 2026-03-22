"use client";

import { motion } from "framer-motion";

interface EconomyEvent {
  event: string;
  [key: string]: any;
}

interface EconomyLogProps {
  events: EconomyEvent[];
}

function formatEvent(e: EconomyEvent): string {
  switch (e.event) {
    case "team_planned": return `CEO hired ${e.agents_hired} agents — $${e.total_allocated} allocated`;
    case "agent_funded": return `${e.role} funded — $${e.budget} sub-delegation`;
    case "agent_fund_failed": return `FAILED to fund ${e.role}: ${e.error}`;
    case "task_completed": return `${e.role} completed task (${e.output_length} chars)`;
    case "task_failed": return `${e.role} FAILED: ${e.error}`;
    case "review_completed": return `reviewer completed evaluation`;
    case "agent_paid": return `PAID ${e.role} — ${e.score}/10 — $${e.paid_amount}/$${e.budget}`;
    case "agent_fired": return `FIRED ${e.role} — ${e.score}/10 — ${e.reason}`;
    case "payment_settled": return `settled: $${e.amount} to ${e.role}`;
    case "delegation_revoked": return `revoked: ${e.role} — $${e.budget_recovered} recovered`;
    case "payroll_complete": return `payroll: $${e.total_paid} paid, $${e.total_recovered} recovered, ${e.tx_count} txs`;
    case "payroll_failed": return `payroll FAILED: ${e.error}`;
    default: return JSON.stringify(e);
  }
}

export function EconomyLog({ events }: EconomyLogProps) {
  if (!events || events.length === 0) return null;

  return (
    <motion.div
      className="card p-7"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-white/[0.07] flex items-center justify-center">
            <span className="text-[12px] text-white/50 font-mono">&gt;</span>
          </div>
          <p className="label-xs">Economy Log</p>
        </div>
        <span className="text-[11px] text-white/15 font-mono">{events.length} events</span>
      </div>

      <div className="card-sm p-4 rounded-xl max-h-64 overflow-y-auto">
        <div className="space-y-1">
          {events.map((event, i) => {
            const isError = event.event.includes("fail") || event.event.includes("fired") || event.event.includes("revoked");
            const isPay = event.event.includes("paid") || event.event.includes("settled") || event.event === "payroll_complete";

            return (
              <div
                key={i}
                className="flex items-start gap-3 py-1 hover:bg-white/[0.015] px-2 rounded-lg transition-colors text-[12px] font-mono"
              >
                <span className="text-white/[0.1] select-none flex-shrink-0 w-5 text-right tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`leading-relaxed ${
                  isError ? "text-red-400/45" :
                  isPay ? "text-emerald-400/45" :
                  "text-white/30"
                }`}>
                  {formatEvent(event)}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-3 py-1 px-2">
            <span className="text-white/[0.1] select-none w-5 text-right tabular-nums text-[12px] font-mono">
              {String(events.length + 1).padStart(2, "0")}
            </span>
            <span className="text-white/18 font-mono" style={{ animation: "blink 1.2s infinite" }}>_</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
