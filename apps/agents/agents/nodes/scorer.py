import hashlib
from agents.state import PactState
from agents.tools.openrouter import score_contribution
from config import settings


def handle_to_address(handle: str) -> str:
    """Generate a deterministic valid Ethereum address from a GitHub handle."""
    h = hashlib.sha256(handle.encode()).hexdigest()[:40]
    return f"0x{h}"


async def scorer_node(state: PactState) -> dict:
    """Score each contribution using LLM and compute payment weights."""
    print("[Scorer] Scoring contributions...")

    scores: dict[str, float] = {}
    contributor_handles: dict[str, str] = {}

    for contrib in state["raw_contributions"]:
        # Use wallet if registered, otherwise use GitHub handle as key for demo
        wallet = contrib.get("author_wallet", "")
        if not wallet or wallet == "0x0000000000000000000000000000000000000000":
            wallet = handle_to_address(contrib["author_handle"])

        # Track address → handle mapping
        contributor_handles[wallet] = contrib["author_handle"]

        try:
            result = await score_contribution(
                api_key=settings.openrouter_api_key,
                title=contrib["title"],
                description=contrib["description"],
                diff_summary=contrib["diff_summary"],
            )
            score = float(result.get("score", 5))
            reason = result.get("reason", "")
            print(f"[Scorer] {contrib['author_handle']}: {score}/10 — {reason}")

            # Accumulate scores per wallet (contributor may have multiple PRs)
            scores[wallet] = scores.get(wallet, 0) + score
        except Exception as e:
            print(f"[Scorer] Error scoring PR #{contrib['pr_number']}: {e}")
            scores[wallet] = scores.get(wallet, 0) + 5  # default score on error

    # Compute weights and payment amounts
    total = sum(scores.values()) or 1
    weights = {addr: score / total for addr, score in scores.items()}
    payment_amounts = {
        addr: round(w * state["budget_usdc"], 2)
        for addr, w in weights.items()
    }

    print(f"[Scorer] Payment distribution: {payment_amounts}")
    return {"scores": scores, "weights": weights, "payment_amounts": payment_amounts, "contributor_handles": contributor_handles}
