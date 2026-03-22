"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LiveAgent {
  role: string;
  budget: number;
  status: string;
  quality_score: number;
  paid_amount: number;
  task: string;
}

interface LiveAgentPanelProps {
  agents: LiveAgent[];
  isRunning: boolean;
  currentStep?: string;
  selectedAgent?: number | null;
  onSelectAgent?: (idx: number | null) => void;
}

const ROLE_CONFIG: Record<string, {
  title: string;
  emoji: string;
  color: string;
  bgColor: string;
  glowColor: string;
  borderColor: string;
  activities: string[];
  thinkingMessages: string[];
}> = {
  analyst: {
    title: "Senior Analyst",
    emoji: "A",
    color: "text-blue-300",
    bgColor: "bg-blue-500/15",
    glowColor: "rgba(96,165,250,0.1)",
    borderColor: "rgba(96,165,250,0.2)",
    activities: [
      "Pulling on-chain metrics from DeFi Llama...",
      "Cross-referencing TVL data across protocols...",
      "Building comparison matrix...",
      "Analyzing smart contract architecture...",
      "Extracting key performance indicators...",
    ],
    thinkingMessages: [
      "Interesting pattern in the data...",
      "The numbers tell a clear story here...",
      "This metric is significantly above average...",
    ],
  },
  strategist: {
    title: "Chief Strategist",
    emoji: "S",
    color: "text-purple-300",
    bgColor: "bg-purple-500/15",
    glowColor: "rgba(167,139,250,0.1)",
    borderColor: "rgba(167,139,250,0.2)",
    activities: [
      "Evaluating competitive positioning...",
      "Building risk-reward framework...",
      "Stress-testing investment thesis...",
      "Modeling probability-weighted scenarios...",
    ],
    thinkingMessages: [
      "The strategic moat is strong but...",
      "Market timing suggests caution...",
      "This could be a 10x opportunity if...",
    ],
  },
  risk_officer: {
    title: "Chief Risk Officer",
    emoji: "R",
    color: "text-amber-300",
    bgColor: "bg-amber-500/15",
    glowColor: "rgba(251,191,36,0.1)",
    borderColor: "rgba(251,191,36,0.2)",
    activities: [
      "Scanning for smart contract vulnerabilities...",
      "Assessing oracle manipulation risks...",
      "Building risk probability matrix...",
      "Identifying potential attack surfaces...",
    ],
    thinkingMessages: [
      "Found a potential red flag...",
      "This governance structure is concerning...",
      "Bridge risk is higher than expected...",
    ],
  },
  writer: {
    title: "Executive Writer",
    emoji: "W",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/15",
    glowColor: "rgba(52,211,153,0.1)",
    borderColor: "rgba(52,211,153,0.2)",
    activities: [
      "Structuring executive summary...",
      "Synthesizing analyst findings...",
      "Writing conclusion and next steps...",
      "Final quality check on document...",
    ],
    thinkingMessages: [
      "The narrative needs to be tighter...",
      "This section needs more impact...",
      "Making the recommendation clear...",
    ],
  },
  engineer: {
    title: "Lead Engineer",
    emoji: "E",
    color: "text-cyan-300",
    bgColor: "bg-cyan-500/15",
    glowColor: "rgba(34,211,238,0.1)",
    borderColor: "rgba(34,211,238,0.2)",
    activities: [
      "Designing contract architecture...",
      "Writing core implementation logic...",
      "Optimizing gas consumption...",
      "Documenting architecture decisions...",
    ],
    thinkingMessages: [
      "This pattern is more gas-efficient...",
      "The interface should expose...",
      "Adding a reentrancy guard here...",
    ],
  },
  reviewer: {
    title: "QA Reviewer",
    emoji: "Q",
    color: "text-rose-300",
    bgColor: "bg-rose-500/15",
    glowColor: "rgba(251,113,133,0.1)",
    borderColor: "rgba(251,113,133,0.2)",
    activities: [
      "Reading analyst's output...",
      "Cross-checking data accuracy...",
      "Scoring each agent's work...",
      "Writing final assessment...",
    ],
    thinkingMessages: [
      "This claim needs verification...",
      "Solid work here, scoring high...",
      "This output is too generic...",
    ],
  },
  researcher: {
    title: "Researcher",
    emoji: "R",
    color: "text-teal-300",
    bgColor: "bg-teal-500/15",
    glowColor: "rgba(45,212,191,0.1)",
    borderColor: "rgba(45,212,191,0.2)",
    activities: [
      "Researching protocol documentation...",
      "Analyzing competitive landscape...",
      "Building research report...",
    ],
    thinkingMessages: [
      "Interesting finding here...",
      "The data supports this thesis...",
    ],
  },
};

function getConfig(role: string) {
  const baseRole = role.split("_")[0];
  return ROLE_CONFIG[baseRole] || ROLE_CONFIG.researcher;
}

function LiveAgentCard({ agent, index, isRunning, isSelected, onClick }: {
  agent: LiveAgent;
  index: number;
  isRunning: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = getConfig(agent.role);
  const [activityIdx, setActivityIdx] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [showThought, setShowThought] = useState(false);
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const isWorking = agent.status === "working" || (isRunning && agent.status === "spawned");
  const isDone = agent.status === "completed" || agent.status === "paid";
  const isFired = agent.status === "fired";

  useEffect(() => {
    if (!isWorking) return;
    const interval = setInterval(() => setActivityIdx((p) => (p + 1) % config.activities.length), 4500);
    return () => clearInterval(interval);
  }, [isWorking, config.activities.length]);

  useEffect(() => {
    if (!isWorking) return;
    const interval = setInterval(() => {
      setShowThought(true);
      setThinkingIdx((p) => (p + 1) % config.thinkingMessages.length);
      setTimeout(() => setShowThought(false), 3000);
    }, 7000);
    return () => clearInterval(interval);
  }, [isWorking, config.thinkingMessages.length]);

  useEffect(() => {
    if (!isWorking) return;
    const text = config.activities[activityIdx];
    setTypedText("");
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) { setTypedText(text.slice(0, i + 1)); i++; }
      else clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [activityIdx, isWorking, config.activities]);

  useEffect(() => {
    if (!isWorking) return;
    const interval = setInterval(() => setCharCount((p) => p + Math.floor(Math.random() * 60) + 15), 2000);
    return () => clearInterval(interval);
  }, [isWorking]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isFired ? 0.3 : 1, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.4, type: "spring" }}
      onClick={onClick}
      className={`relative rounded-[18px] cursor-pointer transition-all duration-300 overflow-hidden ${
        isSelected ? "ring-1 ring-white/20" : ""
      }`}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${isWorking ? config.borderColor : "rgba(255,255,255,0.06)"}`,
        boxShadow: isWorking
          ? `0 0 40px ${config.glowColor}, 0 0 80px ${config.glowColor}`
          : isDone
            ? `0 0 20px rgba(52,211,153,0.05)`
            : "none",
      }}
    >
      {/* Scan line for working */}
      {isWorking && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ overflow: "hidden" }}
        >
          <motion.div
            className="w-full h-[1px]"
            style={{ background: `linear-gradient(90deg, transparent, ${config.borderColor}, transparent)` }}
            animate={{ y: ["-10px", "200px"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      )}

      <div className="p-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${config.bgColor} flex items-center justify-center relative`}>
              <span className={`text-[13px] font-bold ${config.color}`}>{config.emoji}</span>
              {isWorking && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
              {isFired && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-400" />}
            </div>
            <div>
              <p className={`text-[13px] font-semibold capitalize ${isFired ? "text-red-400/50 line-through" : "text-white/80"}`}>
                {agent.role.replace("_", " ")}
              </p>
              <p className="text-[10px] text-white/30">{config.title}</p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[13px] font-mono font-semibold ${
              isFired ? "text-red-400/50" : isDone ? "text-emerald-400/70" : "text-white/45"
            }`}>
              {isFired ? "FIRED" : isDone ? `$${agent.paid_amount}` : `$${agent.budget}`}
            </span>
            {isDone && agent.quality_score > 0 && (
              <p className="text-[10px] text-white/30 font-mono">{agent.quality_score}/10</p>
            )}
          </div>
        </div>

        {/* Task preview */}
        <p className="text-[11px] text-white/25 mb-2 line-clamp-1">{agent.task}</p>

        {/* Live activity */}
        {isWorking && (
          <div className="space-y-2">
            <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                  <span className="text-[9px] text-emerald-400/60 uppercase tracking-wider font-semibold">Working</span>
                </div>
                <span className="text-[9px] text-white/15 font-mono">{charCount > 0 ? `${charCount.toLocaleString()} chars` : ""}</span>
              </div>
              <p className="text-[12px] text-white/45 font-mono leading-relaxed">
                {typedText}
                <motion.span className="text-white/25 ml-0.5" animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>|</motion.span>
              </p>
            </div>

            <AnimatePresence>
              {showThought && (
                <motion.p
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  className="text-[11px] text-white/25 italic pl-2"
                >
                  ~ &ldquo;{config.thinkingMessages[thinkingIdx]}&rdquo;
                </motion.p>
              )}
            </AnimatePresence>

            <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${config.glowColor}, rgba(255,255,255,0.12))` }}
                animate={{ width: ["5%", "40%", "25%", "65%", "45%", "90%"] }}
                transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}

        {/* Done */}
        {isDone && !isFired && (
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400/60"><path d="M20 6L9 17l-5-5" /></svg>
              <span className="text-[11px] text-emerald-400/50">Delivered -- ${agent.paid_amount}</span>
            </div>
            <span className="text-[10px] text-white/20 font-mono">click to view</span>
          </div>
        )}

        {isFired && (
          <div className="flex items-center gap-1.5 mt-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400/50"><path d="M18 6L6 18M6 6l12 12" /></svg>
            <span className="text-[11px] text-red-400/40">Fired -- $0</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function LiveAgentPanel({ agents, isRunning, currentStep, selectedAgent, onSelectAgent }: LiveAgentPanelProps) {
  if (agents.length === 0 && !isRunning) return null;

  const activeCount = agents.filter((a) => a.status === "working" || a.status === "spawned").length;
  const doneCount = agents.filter((a) => a.status === "completed" || a.status === "paid").length;
  const firedCount = agents.filter((a) => a.status === "fired").length;

  const isHiring = isRunning && agents.length === 0;
  const stepLabel =
    currentStep === "ceo_planner" ? "CEO analyzing task & building team..." :
    currentStep === "budget_guardian" ? "Checking budget allowance..." :
    currentStep === "agent_spawner" ? "Creating sub-delegations..." :
    "Initializing...";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/[0.07] flex items-center justify-center relative">
            <span className="text-[13px] text-white/60 font-mono">&gt;_</span>
            {isRunning && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />}
          </div>
          <div>
            <p className="label-xs">Live Agents</p>
            <p className="text-[10px] text-white/20 font-mono mt-0.5">
              {isHiring ? stepLabel : isRunning ? `${activeCount} working -- ${doneCount} done` : `${doneCount} completed -- ${firedCount} fired`}
            </p>
          </div>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400/60 font-mono">live</span>
          </div>
        )}
      </div>

      {/* Connecting line from CEO */}
      {agents.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-2">
          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-white/50">CEO</span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-white/15 via-white/[0.06] to-transparent flow-line" />
          <span className="text-[9px] text-white/15 font-mono">{agents.length} agents</span>
        </div>
      )}

      {/* Skeleton */}
      {isHiring && (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="rounded-[18px] p-4"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.15, type: "spring" }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 bg-white/[0.04] rounded-lg w-20 animate-pulse" />
                  <div className="h-2 bg-white/[0.03] rounded-lg w-14 animate-pulse" />
                </div>
              </div>
              <div className="h-2 bg-white/[0.03] rounded w-full animate-pulse mb-1.5" />
              <div className="h-2 bg-white/[0.03] rounded w-3/4 animate-pulse" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Agent cards */}
      {agents.length > 0 && (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {agents.map((agent, i) => (
            <LiveAgentCard
              key={agent.role + i}
              agent={agent}
              index={i}
              isRunning={isRunning}
              isSelected={selectedAgent === i}
              onClick={() => onSelectAgent?.(selectedAgent === i ? null : i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
