"use client";

import { GlassCard } from "../ui/GlassCard";

interface Contributor {
  address: string;
  handle: string;
  score: number;
  earned: number;
  txHash?: string;
}

interface ContributorTableProps {
  contributors: Contributor[];
}

export function ContributorTable({ contributors }: ContributorTableProps) {
  return (
    <GlassCard>
      <h3 className="text-lg font-semibold mb-4">Contributor Leaderboard</h3>
      {contributors.length === 0 ? (
        <p className="text-white/40 text-sm">
          No contributions scored yet. Run the agent pipeline to evaluate PRs.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full glass-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Contributor</th>
                <th>Score</th>
                <th>Earned (USDC)</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {contributors
                .sort((a, b) => b.score - a.score)
                .map((c, i) => (
                  <tr key={c.address} className="hover:bg-white/5 transition-colors">
                    <td className="text-white/40">{i + 1}</td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-purple-300 text-sm">
                          @{c.handle}
                        </span>
                        <span className="text-white/30 font-mono text-xs">
                          {c.address.slice(0, 6)}...{c.address.slice(-4)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-teal-300">
                        {c.score.toFixed(1)}
                      </span>
                    </td>
                    <td className="font-mono">${c.earned.toFixed(2)}</td>
                    <td>
                      {c.txHash ? (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${c.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 text-xs font-mono"
                        >
                          {c.txHash.slice(0, 8)}...
                        </a>
                      ) : (
                        <span className="text-white/20 text-xs">pending</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
