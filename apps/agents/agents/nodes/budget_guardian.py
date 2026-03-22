from agents.state import PactState
from agents.tools.onchain_client import OnchainClient
from config import settings


async def budget_guardian_node(state: PactState) -> dict:
    """Check ERC-7715 period allowance and block if budget exceeded."""
    print("[BudgetGuardian] Checking remaining allowance...")

    onchain = OnchainClient(settings.onchain_service_url)

    try:
        remaining = await onchain.get_remaining_allowance(state["permissions_context"])
    except Exception as e:
        print(f"[BudgetGuardian] Error checking allowance: {e}")
        return {"is_blocked": True, "period_spent": 0}

    total_to_pay = sum(state["payment_amounts"].values())

    if total_to_pay > remaining:
        print(
            f"[BudgetGuardian] Budget exceeded: need ${total_to_pay}, "
            f"only ${remaining} remaining. Scaling down."
        )
        scale = remaining / total_to_pay if total_to_pay > 0 else 0
        scaled_amounts = {
            addr: round(amt * scale, 2)
            for addr, amt in state["payment_amounts"].items()
        }
        return {
            "payment_amounts": scaled_amounts,
            "is_blocked": False,
            "period_spent": remaining,
        }

    print(f"[BudgetGuardian] Budget OK: ${total_to_pay} of ${remaining} remaining")
    return {"is_blocked": False, "period_spent": total_to_pay}
