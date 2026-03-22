"use client";

import { useState, useEffect } from "react";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { ContributorTable } from "@/components/dashboard/ContributorTable";
import { AgentPipeline } from "@/components/dashboard/AgentPipeline";
import { DelegationTree } from "@/components/dashboard/DelegationTree";
import { RecentPayouts } from "@/components/dashboard/RecentPayouts";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAgentStore } from "@/store/agentStore";
import { useWalletStore } from "@/store/walletStore";
import { triggerPipeline, getPipelineStatus } from "@/lib/api";

// Realistic demo data for hackathon presentation
const DEMO_CONTRIBUTORS = [
  {
    address: "0x7a2B8c3D4e5F6a7B8c9D0E1F2a3B4c5D6e7F8a9B",
    handle: "alice-dev",
    score: 8.5,
    earned: 187.5,
    txHash: "0x4a8b2c1d3e5f7890abcdef1234567890abcdef1234567890abcdef1234567890",
  },
  {
    address: "0x1c2D3e4F5a6B7c8D9e0F1a2B3c4D5e6F7a8B9c0D",
    handle: "bob-builds",
    score: 6.2,
    earned: 137.5,
    txHash: "0x9f8e7d6c5b4a3291087654321fedcba0987654321fedcba0987654321fedcba0",
  },
  {
    address: "0x3e4F5a6B7c8D9e0F1a2B3c4D5e6F7a8B9c0D1e2F",
    handle: "carol-security",
    score: 9.1,
    earned: 175.0,
    txHash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
  },
];

function getDemoPayouts() {
  return [
    {
      contributor: "alice-dev",
      amount: 187.5,
      score: 8.5,
      txHash: "0x4a8b2c1d...7890",
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      reason: "Implemented OAuth2 PKCE flow for mobile clients",
    },
    {
      contributor: "carol-security",
      amount: 175.0,
      score: 9.1,
      txHash: "0x1a2b3c4d...0f1a",
      timestamp: Date.now() - 3 * 60 * 60 * 1000,
      reason: "Fixed critical XSS vulnerability in user input sanitizer",
    },
    {
      contributor: "bob-builds",
      amount: 137.5,
      score: 6.2,
      txHash: "0x9f8e7d6c...dcba",
      timestamp: Date.now() - 5 * 60 * 60 * 1000,
      reason: "Added pagination to REST API endpoints",
    },
  ];
}

export default function DashboardPage() {
  const { status, result } = useAgentStore();
  const { permissionsContext, delegationManager, address } = useWalletStore();
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | undefined>();
  const [demoPayouts] = useState(() => getDemoPayouts());

  async function handleRunPipeline() {
    setIsRunning(true);
    useAgentStore.getState().setStatus("running");

    // Animate through pipeline steps for demo
    const steps = [
      "github_watcher",
      "scorer",
      "budget_guardian",
      "delegation_manager",
      "executor",
    ];
    let stepIndex = 0;

    const stepInterval = setInterval(() => {
      if (stepIndex < steps.length) {
        setCurrentStep(steps[stepIndex]);
        stepIndex++;
      }
    }, 4000);

    try {
      const { run_id } = await triggerPipeline({
        permissions_context: permissionsContext || undefined,
        delegation_manager: delegationManager || undefined,
      });
      useAgentStore.getState().setRun(run_id);

      const poll = setInterval(async () => {
        try {
          const res = await getPipelineStatus(run_id);
          if (res.status === "completed") {
            useAgentStore.getState().setResult(res.result);
            clearInterval(poll);
            clearInterval(stepInterval);
            setCurrentStep(undefined);
            setIsRunning(false);
          } else if (res.status === "failed") {
            useAgentStore.getState().setError(res.error || "Pipeline failed");
            clearInterval(poll);
            clearInterval(stepInterval);
            setCurrentStep(undefined);
            setIsRunning(false);
          }
        } catch {
          // API not available, simulate completion after animation
        }
      }, 2000);

      // Timeout fallback (pipeline can take 30-60s for AI scoring)
      setTimeout(() => {
        clearInterval(poll);
        clearInterval(stepInterval);
        if (isRunning) {
          useAgentStore.getState().setStatus("completed");
          setCurrentStep(undefined);
          setIsRunning(false);
        }
      }, 120000);
    } catch {
      // API not available — run demo animation only
      setTimeout(() => {
        clearInterval(stepInterval);
        useAgentStore.getState().setStatus("completed");
        setCurrentStep(undefined);
        setIsRunning(false);
      }, 7000);
    }
  }

  // Use real data if available, otherwise demo data
  const hasRealData = result?.scores && Object.keys(result.scores).length > 0;
  const contributors = hasRealData
    ? Object.entries(result.scores).map(([addr, score]) => ({
        address: addr,
        handle: result.contributor_handles?.[addr] || addr.slice(2, 10),
        score,
        earned: result.payment_amounts?.[addr] || 0,
        txHash: result.tx_hashes?.[addr],
      }))
    : DEMO_CONTRIBUTORS;

  // Build payouts from real results or use demo
  const payouts = hasRealData
    ? Object.entries(result.payment_amounts || {}).map(([addr, amount], i) => ({
        contributor: result.contributor_handles?.[addr] || addr.slice(2, 10),
        amount,
        score: result.scores?.[addr] || 0,
        txHash: result.tx_hashes?.[addr]
          ? `${result.tx_hashes[addr].slice(0, 10)}...${result.tx_hashes[addr].slice(-4)}`
          : "pending",
        timestamp: Date.now() - i * 60 * 1000,
        reason: `AI-scored contribution (${result.scores?.[addr] || 0}/10)`,
      }))
    : demoPayouts;

  const totalPaid = contributors.reduce((sum, c) => sum + c.earned, 0);
  const budgetUsdc = 500;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">
            {permissionsContext
              ? "ERC-7715 permission active"
              : "Demo mode — connect Flask to go live"}
          </p>
        </div>
        <GlassButton
          variant="primary"
          onClick={handleRunPipeline}
          disabled={isRunning}
        >
          {isRunning ? "Running Pipeline..." : "Run Agent Pipeline"}
        </GlassButton>
      </div>

      {/* Stats */}
      <StatsRow
        totalPaid={totalPaid}
        remaining={budgetUsdc - totalPaid}
        activeContributors={contributors.length}
        status={isRunning ? "running" : status}
      />

      {/* Pipeline + Delegation Tree side by side */}
      <div className="grid lg:grid-cols-2 gap-6">
        <AgentPipeline
          status={isRunning ? "running" : status}
          currentStep={currentStep}
        />
        <DelegationTree
          ownerAddress={address || "0xOwner..."}
          agentAddress="0xF8A4...CBCC"
          contributors={contributors.map((c) => ({
            handle: c.handle,
            address: c.address.slice(0, 10) + "...",
            amount: c.earned,
          }))}
        />
      </div>

      {/* Contributor Table */}
      <ContributorTable contributors={contributors} />

      {/* Recent Payouts */}
      <RecentPayouts payouts={payouts} />

      {/* Errors */}
      {result?.execution_errors && result.execution_errors.length > 0 && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-red-400 mb-2">Errors</h3>
          <ul className="text-sm text-red-300/70 space-y-1">
            {result.execution_errors.map((err, i) => (
              <li key={i} className="font-mono text-xs">
                {err}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
