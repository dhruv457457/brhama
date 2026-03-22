import { create } from "zustand";

interface AgentState {
  currentRunId: string | null;
  status: "idle" | "queued" | "running" | "completed" | "failed";
  result: {
    scores: Record<string, number>;
    payment_amounts: Record<string, number>;
    tx_hashes: Record<string, string>;
    contributor_handles: Record<string, string>;
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

  setRun: (runId) => set({ currentRunId: runId, status: "queued", result: null, error: null }),
  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result, status: "completed" }),
  setError: (error) => set({ error, status: "failed" }),
  reset: () => set({ currentRunId: null, status: "idle", result: null, error: null }),
}));
