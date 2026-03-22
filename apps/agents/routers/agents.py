from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import uuid
import asyncio

from agents.graph import pact_graph
from agents.state import PactState
from config import settings

router = APIRouter(prefix="/api/agents", tags=["agents"])

# In-memory store for pipeline run results
_runs: dict[str, dict] = {}


class RunPipelineRequest(BaseModel):
    repo_owner: Optional[str] = None
    repo_name: Optional[str] = None
    budget_usdc: Optional[float] = None
    permissions_context: Optional[str] = None
    delegation_manager: Optional[str] = None


async def _execute_pipeline(run_id: str, initial_state: PactState):
    """Execute the LangGraph pipeline and store results."""
    try:
        _runs[run_id]["status"] = "running"
        result = await pact_graph.ainvoke(initial_state)
        _runs[run_id]["status"] = "completed"
        _runs[run_id]["result"] = {
            "scores": result.get("scores", {}),
            "payment_amounts": result.get("payment_amounts", {}),
            "tx_hashes": result.get("tx_hashes", {}),
            "contributor_handles": result.get("contributor_handles", {}),
            "execution_errors": result.get("execution_errors", []),
            "is_blocked": result.get("is_blocked", False),
        }
    except Exception as e:
        _runs[run_id]["status"] = "failed"
        _runs[run_id]["error"] = str(e)


@router.post("/run")
async def run_pipeline(req: RunPipelineRequest, background_tasks: BackgroundTasks):
    """Trigger the Pact agent pipeline."""
    run_id = str(uuid.uuid4())[:8]

    repo_parts = settings.github_repo.split("/")
    repo_owner = req.repo_owner or repo_parts[0]
    repo_name = req.repo_name or (repo_parts[1] if len(repo_parts) > 1 else "")

    initial_state: PactState = {
        "repo_owner": repo_owner,
        "repo_name": repo_name,
        "budget_usdc": req.budget_usdc or settings.budget_usdc,
        "period_days": settings.period_days,
        "permissions_context": req.permissions_context or settings.permissions_context,
        "delegation_manager": req.delegation_manager or getattr(settings, 'delegation_manager', ''),
        "agent_wallet_address": "",
        "raw_contributions": [],
        "scores": {},
        "weights": {},
        "payment_amounts": {},
        "period_spent": 0,
        "is_blocked": False,
        "contributor_handles": {},
        "sub_delegations": {},
        "tx_hashes": {},
        "execution_errors": [],
    }

    _runs[run_id] = {"status": "queued", "result": None, "error": None}
    background_tasks.add_task(_execute_pipeline, run_id, initial_state)

    return {"run_id": run_id, "status": "queued"}


@router.get("/status/{run_id}")
async def get_status(run_id: str):
    """Get the status of a pipeline run."""
    run = _runs.get(run_id)
    if not run:
        return {"error": "Run not found"}, 404
    return run


@router.get("/runs")
async def list_runs():
    """List all pipeline runs."""
    return {
        run_id: {"status": run["status"]}
        for run_id, run in _runs.items()
    }
