import { create } from "zustand";

interface AgentWorker {
  agent_id: string;
  role: string;
  task: string;
  budget: number;
  status: string; // "spawned" | "working" | "completed" | "paid" | "fired"
  output: string;
  quality_score: number;
  paid_amount: number;
  wallet_address: string;
}

interface EconomyEvent {
  event: string;
  [key: string]: any;
}

interface AgentState {
  currentRunId: string | null;
  status: "idle" | "queued" | "running" | "completed" | "failed";
  result: {
    agents: AgentWorker[];
    ceo_reasoning: string;
    economy_log: EconomyEvent[];
    payment_amounts: Record<string, number>;
    agent_handles: Record<string, string>;
    tx_hashes: Record<string, string>;
    total_paid: number;
    total_allocated: number;
    execution_errors: string[];
    is_blocked: boolean;
  } | null;
  error: string | null;
  setRun: (runId: string) => void;
  setStatus: (status: AgentState["status"]) => void;
  setResult: (result: AgentState["result"]) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  currentRunId: null,
  status: "idle",
  result: null,
  error: null,

  setRun: (runId) =>
    set({ currentRunId: runId, status: "queued", result: null, error: null }),
  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error, status: "failed" }),
  reset: () =>
    set({ currentRunId: null, status: "idle", result: null, error: null }),
}));
