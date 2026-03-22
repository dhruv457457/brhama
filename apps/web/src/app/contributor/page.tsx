"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { useWalletStore } from "@/store/walletStore";
import { useState } from "react";

// Demo contributor data
const DEMO_PROFILE = {
  address: "0x7a2B8c3D4e5F6a7B8c9D0E1F2a3B4c5D6e7F8a9B",
  handle: "alice-dev",
  totalEarned: 562.5,
  totalPayouts: 4,
  reputationScore: 32.3,
  contributions: [
    {
      pr: "#142",
      title: "Implement OAuth2 PKCE flow for mobile clients",
      score: 8.5,
      earned: 187.5,
      date: "2026-03-20",
    },
    {
      pr: "#128",
      title: "Add rate limiting middleware",
      score: 7.2,
      earned: 145.0,
      date: "2026-03-13",
    },
    {
      pr: "#115",
      title: "Fix memory leak in WebSocket handler",
      score: 9.0,
      earned: 165.0,
      date: "2026-03-06",
    },
    {
      pr: "#98",
      title: "Update API documentation",
      score: 3.5,
      earned: 65.0,
      date: "2026-02-27",
    },
  ],
};

export default function ContributorPage() {
  const { address, connect } = useWalletStore();
  const [handle, setHandle] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const profile = DEMO_PROFILE;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold">Contributor Profile</h1>

      {/* Profile card */}
      <GlassCard>
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/40 to-teal-500/40 flex items-center justify-center text-2xl font-bold text-purple-300 flex-shrink-0">
            {profile.handle[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">@{profile.handle}</h2>
            <p className="text-sm font-mono text-white/40 mt-0.5">
              {profile.address}
            </p>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">
                  Total Earned
                </p>
                <p className="text-xl font-semibold text-emerald-300">
                  ${profile.totalEarned.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">
                  Payouts
                </p>
                <p className="text-xl font-semibold text-purple-300">
                  {profile.totalPayouts}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">
                  Reputation
                </p>
                <p className="text-xl font-semibold text-teal-300">
                  {profile.reputationScore.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Register as contributor */}
      {address && (
        <GlassCard>
          <h3 className="text-lg font-semibold mb-3">Register as Contributor</h3>
          <p className="text-sm text-white/50 mb-4">
            Link your GitHub handle to your wallet address to start receiving
            rewards.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="your-github-handle"
              className="glass-input flex-1 px-4 py-2.5"
            />
            <GlassButton
              variant="primary"
              disabled={!handle || isRegistering}
              onClick={async () => {
                setIsRegistering(true);
                // In production: call ContributorRegistry.registerContributor()
                await new Promise((r) => setTimeout(r, 1500));
                setIsRegistering(false);
              }}
            >
              {isRegistering ? "Registering..." : "Register"}
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* Earnings chart (simplified bar chart) */}
      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Earnings Over Time</h3>
        <div className="flex items-end gap-3 h-32">
          {profile.contributions.map((c, i) => {
            const maxEarned = Math.max(
              ...profile.contributions.map((x) => x.earned)
            );
            const height = (c.earned / maxEarned) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-white/50">
                  ${c.earned.toFixed(0)}
                </span>
                <div
                  className="w-full rounded-lg bg-gradient-to-t from-purple-500/40 to-teal-500/30 transition-all duration-500"
                  style={{ height: `${height}%`, minHeight: "8px" }}
                />
                <span className="text-xs text-white/30">{c.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Contribution history */}
      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Contribution History</h3>
        <div className="space-y-3">
          {profile.contributions.map((c, i) => (
            <div
              key={i}
              className="glass-card-sm p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-purple-400">
                    {c.pr}
                  </span>
                  <span className="text-sm text-white/80 truncate">
                    {c.title}
                  </span>
                </div>
                <span className="text-xs text-white/30">{c.date}</span>
              </div>
              <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-white/40">Score</p>
                  <p className="text-sm font-mono text-teal-300">
                    {c.score}/10
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40">Earned</p>
                  <p className="text-sm font-mono text-emerald-300">
                    ${c.earned.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {!address && (
        <div className="text-center">
          <GlassButton variant="primary" size="lg" onClick={connect}>
            Connect Wallet to View Your Profile
          </GlassButton>
        </div>
      )}
    </div>
  );
}
