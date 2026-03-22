"use client";

import { GlassCard } from "../ui/GlassCard";

interface StatsRowProps {
  totalPaid: number;
  remaining: number;
  activeContributors: number;
  status: string;
}

export function StatsRow({
  totalPaid,
  remaining,
  activeContributors,
  status,
}: StatsRowProps) {
  const stats = [
    {
      label: "Paid This Period",
      value: `$${totalPaid.toFixed(2)}`,
      color: "text-teal-300",
    },
    {
      label: "Remaining Budget",
      value: `$${remaining.toFixed(2)}`,
      color: "text-purple-300",
    },
    {
      label: "Active Contributors",
      value: activeContributors.toString(),
      color: "text-blue-300",
    },
    {
      label: "Pipeline Status",
      value: status,
      color:
        status === "completed"
          ? "text-emerald-300"
          : status === "running"
            ? "text-amber-300"
            : "text-white/60",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <GlassCard key={stat.label} small className="p-4">
          <p className="text-xs text-white/50 uppercase tracking-wider">
            {stat.label}
          </p>
          <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>
            {stat.value}
          </p>
        </GlassCard>
      ))}
    </div>
  );
}
