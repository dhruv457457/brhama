from apscheduler.schedulers.asyncio import AsyncIOScheduler
from agents.graph import pact_graph
from agents.state import PactState
from config import settings


async def run_scheduled_pipeline():
    """Scheduled execution of the Pact agent pipeline."""
    print("[Scheduler] Running scheduled pipeline...")

    repo_parts = settings.github_repo.split("/")
    repo_owner = repo_parts[0]
    repo_name = repo_parts[1] if len(repo_parts) > 1 else ""

    if not settings.permissions_context:
        print("[Scheduler] No permissions context configured. Skipping.")
        return

    initial_state: PactState = {
        "repo_owner": repo_owner,
        "repo_name": repo_name,
        "budget_usdc": settings.budget_usdc,
        "period_days": settings.period_days,
        "permissions_context": settings.permissions_context,
        "agent_wallet_address": "",
        "raw_contributions": [],
        "scores": {},
        "weights": {},
        "payment_amounts": {},
        "period_spent": 0,
        "is_blocked": False,
        "sub_delegations": {},
        "tx_hashes": {},
        "execution_errors": [],
    }

    try:
        result = await pact_graph.ainvoke(initial_state)
        print(f"[Scheduler] Pipeline completed. Payments: {result.get('tx_hashes', {})}")
    except Exception as e:
        print(f"[Scheduler] Pipeline failed: {e}")


def create_scheduler() -> AsyncIOScheduler:
    """Create the APScheduler with the pipeline job."""
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_scheduled_pipeline,
        "interval",
        minutes=settings.scheduler_interval_minutes,
        id="pact_pipeline",
        name="Pact Agent Pipeline",
    )
    return scheduler
