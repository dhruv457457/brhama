"use client";

import { GlassCard } from "../ui/GlassCard";

const PIPELINE_STEPS = [
  { id: "github_watcher", label: "GitHub Watcher", icon: "1" },
  { id: "scorer", label: "AI Scorer", icon: "2" },
  { id: "budget_guardian", label: "Budget Guardian", icon: "3" },
  { id: "delegation_manager", label: "Delegation Manager", icon: "4" },
  { id: "executor", label: "On-Chain Executor", icon: "5" },
];

interface AgentPipelineProps {
  status: string;
  currentStep?: string;
}

export function AgentPipeline({ status, currentStep }: AgentPipelineProps) {
  const getStepState = (stepId: string) => {
    if (status === "idle") return "idle";
    if (status === "completed") return "completed";

    const stepIndex = PIPELINE_STEPS.findIndex((s) => s.id === stepId);
    const currentIndex = PIPELINE_STEPS.findIndex(
      (s) => s.id === currentStep
    );
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Agent Pipeline</h3>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {PIPELINE_STEPS.map((step, i) => {
          const state = getStepState(step.id);
          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={`
                  flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all
                  ${state === "completed" ? "bg-emerald-500/20 border border-emerald-500/30" : ""}
                  ${state === "active" ? "bg-purple-500/20 border border-purple-500/30 animate-pulse" : ""}
                  ${state === "pending" ? "bg-white/5 border border-white/10" : ""}
                  ${state === "idle" ? "bg-white/5 border border-white/10" : ""}
                `}
              >
                <span
                  className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full
                    ${state === "completed" ? "bg-emerald-500/40 text-emerald-200" : ""}
                    ${state === "active" ? "bg-purple-500/40 text-purple-200" : ""}
                    ${state === "pending" || state === "idle" ? "bg-white/10 text-white/40" : ""}
                  `}
                >
                  {state === "completed" ? "\u2713" : step.icon}
                </span>
                <span className="text-xs text-center whitespace-nowrap text-white/70">
                  {step.label}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`w-6 h-px flex-shrink-0 ${
                    state === "completed" ? "bg-emerald-500/40" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
