"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { useWalletStore } from "@/store/walletStore";
import Link from "next/link";

export default function Home() {
  const { address, walletType, connect } = useWalletStore();

  return (
    <div className="flex flex-col items-center gap-12 animate-fade-in pb-16">
      {/* Hero */}
      <div className="text-center max-w-2xl pt-8">
        <h1 className="text-6xl sm:text-7xl font-bold tracking-tight mb-4">
          <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
            Pact
          </span>
        </h1>
        <p className="text-xl text-white/70 leading-relaxed mb-2">
          AI agents that autonomously reward open source contributors
        </p>
        <p className="text-sm text-white/40">
          Funded by a single MetaMask permission you sign once.
          No custody. No unlimited approvals. No manual work.
        </p>
      </div>

      {/* CTA Card */}
      <GlassCard className="max-w-md w-full text-center animate-slide-up">
        {!address ? (
          <>
            <p className="text-white/60 mb-6">
              Connect your wallet to start rewarding contributors
            </p>
            <div className="space-y-3">
              <GlassButton
                variant="primary"
                size="lg"
                className="w-full"
                onClick={connect}
              >
                Connect MetaMask Flask
              </GlassButton>
              <GlassButton size="lg" className="w-full" onClick={connect}>
                Connect MetaMask (view only)
              </GlassButton>
            </div>
            <p className="text-xs text-white/30 mt-4">
              MetaMask Flask required for ERC-7715.{" "}
              <a
                href="https://metamask.io/flask/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300"
              >
                Download Flask
              </a>
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white/60 text-sm">Connected</span>
            </div>
            <div className="space-y-3">
              {walletType === "flask" && (
                <Link href="/permissions">
                  <GlassButton variant="primary" size="lg" className="w-full">
                    Set Up Contributor Rewards
                  </GlassButton>
                </Link>
              )}
              <Link href="/dashboard">
                <GlassButton size="lg" className="w-full mt-3">
                  View Dashboard
                </GlassButton>
              </Link>
              <Link href="/contributor">
                <GlassButton size="lg" className="w-full mt-3">
                  Contributor Profile
                </GlassButton>
              </Link>
            </div>
          </>
        )}
      </GlassCard>

      {/* How it works */}
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-semibold text-center mb-8">How Pact Works</h2>
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            {
              step: "1",
              title: "Sign Once",
              desc: "Grant an ERC-7715 periodic permission — set your budget and period",
              color: "text-purple-300",
              border: "border-purple-500/20",
            },
            {
              step: "2",
              title: "AI Evaluates",
              desc: "5 AI agents score every merged PR based on impact and quality",
              color: "text-blue-300",
              border: "border-blue-500/20",
            },
            {
              step: "3",
              title: "Sub-Delegate",
              desc: "Each contributor gets a scoped sub-delegation for their earned share",
              color: "text-teal-300",
              border: "border-teal-500/20",
            },
            {
              step: "4",
              title: "Auto Pay",
              desc: "USDC transfers fire automatically — no manual action needed",
              color: "text-emerald-300",
              border: "border-emerald-500/20",
            },
          ].map((item) => (
            <GlassCard
              key={item.step}
              small
              className={`p-5 ${item.border} hover:bg-white/5 transition-colors`}
            >
              <div
                className={`text-2xl font-bold ${item.color} mb-2`}
              >
                {item.step}
              </div>
              <p className={`text-sm font-medium ${item.color} mb-1`}>
                {item.title}
              </p>
              <p className="text-xs text-white/45 leading-relaxed">
                {item.desc}
              </p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Architecture diagram */}
      <div className="w-full max-w-3xl">
        <GlassCard className="p-8">
          <h3 className="text-lg font-semibold text-center mb-6">
            Architecture
          </h3>
          <div className="space-y-4 text-center">
            {/* Layer 0 */}
            <div className="glass-card-sm p-3 max-w-xs mx-auto">
              <p className="text-xs text-white/40 uppercase tracking-wider">
                Intent
              </p>
              <p className="text-sm text-purple-300 font-medium mt-0.5">
                &quot;Pay contributors $500/month&quot;
              </p>
            </div>
            <div className="text-white/20">↓</div>
            {/* Layer 1 */}
            <div className="glass-card-sm p-3 max-w-sm mx-auto border-purple-500/20">
              <p className="text-xs text-white/40 uppercase tracking-wider">
                ERC-7715 Permission
              </p>
              <p className="text-sm text-white/70 font-mono mt-0.5">
                erc20-token-periodic · 500 USDC · 30 days
              </p>
            </div>
            <div className="text-white/20">↓</div>
            {/* Layer 2 */}
            <div className="glass-card-sm p-3 max-w-md mx-auto border-teal-500/20">
              <p className="text-xs text-white/40 uppercase tracking-wider">
                LangGraph Agent Pipeline
              </p>
              <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
                {[
                  "GitHub Watcher",
                  "AI Scorer",
                  "Budget Guard",
                  "Delegator",
                  "Executor",
                ].map((name, i, arr) => (
                  <span key={name} className="inline-flex items-center gap-1">
                    <span className="text-xs glass-card-sm px-2 py-0.5 text-teal-300">
                      {name}
                    </span>
                    {i < arr.length - 1 && (
                      <span className="text-white/20 text-xs">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-white/20">↓</div>
            {/* Layer 3 */}
            <div className="glass-card-sm p-3 max-w-sm mx-auto border-blue-500/20">
              <p className="text-xs text-white/40 uppercase tracking-wider">
                On-Chain Execution
              </p>
              <p className="text-sm text-blue-300 font-mono mt-0.5">
                redeemDelegation() → USDC Transfer
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Feature cards */}
      <div className="grid sm:grid-cols-3 gap-4 w-full max-w-3xl">
        <GlassCard small className="p-5">
          <p className="text-sm font-medium text-purple-300 mb-2">
            No Unlimited Approvals
          </p>
          <p className="text-xs text-white/50 leading-relaxed">
            ERC-7715 periodic permissions cap spending at exactly what you set.
            The agent cannot increase the limit.
          </p>
        </GlassCard>
        <GlassCard small className="p-5">
          <p className="text-sm font-medium text-teal-300 mb-2">
            Non-Custodial
          </p>
          <p className="text-xs text-white/50 leading-relaxed">
            Funds never leave your wallet until a contributor earns them.
            You can revoke the permission at any time.
          </p>
        </GlassCard>
        <GlassCard small className="p-5">
          <p className="text-sm font-medium text-blue-300 mb-2">
            LLM-Gated Execution
          </p>
          <p className="text-xs text-white/50 leading-relaxed">
            No payment fires unless the AI has evaluated the contribution and
            approved the amount. Novel conditional delegation.
          </p>
        </GlassCard>
      </div>

      {/* Built for hackathon */}
      <div className="text-center text-xs text-white/20 max-w-md">
        Built for the MetaMask Advanced Permissions Dev Cook-Off.
        Uses ERC-7715 + ERC-7710 delegation framework on Sepolia.
      </div>
    </div>
  );
}
