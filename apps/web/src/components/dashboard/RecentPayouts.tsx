"use client";

import { GlassCard } from "../ui/GlassCard";

interface Payout {
  contributor: string;
  amount: number;
  score: number;
  txHash: string;
  timestamp: number;
  reason: string;
}

interface RecentPayoutsProps {
  payouts: Payout[];
}

export function RecentPayouts({ payouts }: RecentPayoutsProps) {
  function timeAgo(ts: number) {
    const diff = Date.now() - ts;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "just now";
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
  }

  return (
    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Recent Payouts</h3>
      <div className="space-y-3">
        {payouts.map((p, i) => (
          <div
            key={i}
            className="glass-card-sm p-4 flex items-start gap-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-teal-500/30 flex items-center justify-center text-sm font-bold text-purple-300">
              ${Math.round(p.amount)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/90">
                  @{p.contributor}
                </span>
                <span className="text-xs text-white/30">{timeAgo(p.timestamp)}</span>
              </div>
              <p className="text-xs text-white/50 mt-0.5 truncate">
                {p.reason}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-teal-300/80">
                  Score: {p.score}/10
                </span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${p.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-purple-400 hover:text-purple-300"
                >
                  {p.txHash}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
