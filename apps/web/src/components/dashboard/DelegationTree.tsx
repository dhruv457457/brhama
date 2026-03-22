"use client";

import { GlassCard } from "../ui/GlassCard";

interface DelegationTreeProps {
  ownerAddress: string;
  agentAddress: string;
  contributors: { handle: string; address: string; amount: number }[];
}

export function DelegationTree({
  ownerAddress,
  agentAddress,
  contributors,
}: DelegationTreeProps) {
  return (
    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">A2A Delegation Tree</h3>
      <div className="space-y-3">
        {/* Root: Owner */}
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-purple-500 flex-shrink-0" />
          <div className="glass-card-sm px-3 py-2 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-purple-300">
                Project Owner
              </span>
              <span className="text-xs font-mono text-white/30">
                {ownerAddress.slice(0, 12)}...
              </span>
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              ERC-7715 erc20-token-periodic
            </div>
          </div>
        </div>

        {/* Line */}
        <div className="ml-[5px] w-px h-4 bg-gradient-to-b from-purple-500/40 to-teal-500/40" />

        {/* Orchestrator Agent */}
        <div className="flex items-center gap-3 ml-4">
          <div className="w-3 h-3 rounded-full bg-teal-500 flex-shrink-0" />
          <div className="glass-card-sm px-3 py-2 flex-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-teal-300">
                Orchestrator Agent
              </span>
              <span className="text-xs font-mono text-white/30">
                {agentAddress}
              </span>
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              LangGraph 5-node pipeline
            </div>
          </div>
        </div>

        {/* Lines to contributors */}
        <div className="ml-[21px] w-px h-3 bg-gradient-to-b from-teal-500/40 to-blue-500/40" />

        {/* Sub-delegations */}
        <div className="ml-8 space-y-2">
          {contributors.map((c) => (
            <div key={c.handle} className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
              <div className="glass-card-sm px-3 py-1.5 flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-blue-300">@{c.handle}</span>
                  <span className="text-xs font-mono text-emerald-300">
                    ${c.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5">
        <p className="text-xs text-white/30">
          Each sub-delegation is scoped to the contributor&#39;s earned share.
          No contributor can access another&#39;s funds.
        </p>
      </div>
    </GlassCard>
  );
}
