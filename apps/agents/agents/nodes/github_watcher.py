from agents.state import PactState
from agents.tools.github_api import fetch_merged_prs
from agents.tools.onchain_client import OnchainClient
from config import settings


async def github_watcher_node(state: PactState) -> dict:
    """Fetch merged PRs and resolve contributor wallet addresses."""
    print("[GitHubWatcher] Fetching merged PRs...")

    contributions = await fetch_merged_prs(
        repo_owner=state["repo_owner"],
        repo_name=state["repo_name"],
        github_token=settings.github_token,
        days=state["period_days"],
    )

    # Resolve GitHub handles to wallet addresses via on-chain registry
    onchain = OnchainClient(settings.onchain_service_url)
    for contrib in contributions:
        try:
            wallet = await onchain.get_wallet_for_handle(contrib["author_handle"])
            contrib["author_wallet"] = wallet
        except Exception:
            contrib["author_wallet"] = ""

    print(f"[GitHubWatcher] Found {len(contributions)} merged PRs")
    return {"raw_contributions": contributions}
