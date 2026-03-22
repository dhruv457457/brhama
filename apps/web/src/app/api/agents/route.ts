import { NextRequest, NextResponse } from "next/server";

const AGENTS_API = process.env.AGENTS_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await fetch(`${AGENTS_API}/api/agents/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("run_id");

  if (runId) {
    const res = await fetch(`${AGENTS_API}/api/agents/status/${runId}`);
    const data = await res.json();
    return NextResponse.json(data);
  }

  const res = await fetch(`${AGENTS_API}/api/agents/runs`);
  const data = await res.json();
  return NextResponse.json(data);
}
