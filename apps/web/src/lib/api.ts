const AGENTS_API =
  process.env.NEXT_PUBLIC_AGENTS_API_URL || "http://localhost:8000";

export async function triggerPipeline(params?: {
  repo_owner?: string;
  repo_name?: string;
  budget_usdc?: number;
  permissions_context?: string;
  delegation_manager?: string;
}) {
  const res = await fetch(`${AGENTS_API}/api/agents/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {}),
  });
  return res.json();
}

export async function getPipelineStatus(runId: string) {
  const res = await fetch(`${AGENTS_API}/api/agents/status/${runId}`);
  return res.json();
}

export async function listPipelineRuns() {
  const res = await fetch(`${AGENTS_API}/api/agents/runs`);
  return res.json();
}
