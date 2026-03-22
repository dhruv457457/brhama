from agents.state import PactState
from agents.tools.onchain_client import OnchainClient
from config import settings


async def payroll_node(state: PactState) -> dict:
    """
    Executes the payroll — redeems delegations to pay performing agents,
    revokes delegations for fired agents.
    This is the on-chain settlement layer of the AI economy.
    """
    print("[Payroll] Executing agent payroll on-chain...")

    onchain = OnchainClient(settings.onchain_service_url)
    economy_log = list(state.get("economy_log", []))

    # Build payment requests for agents that earned pay
    payments = []
    delegation_manager = state.get("delegation_manager", "")

    for wallet_address, amount in state["payment_amounts"].items():
        if amount <= 0:
            continue

        sub_context = state["sub_delegations"].get(wallet_address, "")
        if not sub_context:
            continue

        # Find the agent's role for logging
        role = state["agent_handles"].get(wallet_address, "unknown")

        payments.append({
            "contributorAddress": wallet_address,
            "amountUsdc": amount,
            "aiScore": 0,  # Not needed for agent payments
            "permissionsContext": sub_context,
            "delegationManager": delegation_manager,
        })

    if not payments:
        print("[Payroll] No payments to execute")
        return {"tx_hashes": {}, "execution_errors": []}

    print(f"[Payroll] Executing {len(payments)} agent payments...")

    try:
        results = await onchain.execute_payments(payments)
    except Exception as e:
        error_msg = str(e) or "Unknown error (possibly timeout — payments may have succeeded)"
        print(f"[Payroll] Batch execution failed: {error_msg}")
        economy_log.append({
            "event": "payroll_failed",
            "error": error_msg,
        })
        return {
            "tx_hashes": {},
            "execution_errors": [error_msg],
            "economy_log": economy_log,
        }

    tx_hashes = {}
    errors = []
    for result in results:
        addr = result["contributorAddress"]
        role = state["agent_handles"].get(addr, "unknown")
        if result.get("txHash"):
            tx_hashes[addr] = result["txHash"]
            print(f"[Payroll] Paid {role} ({addr[:10]}...): tx {result['txHash']}")
            economy_log.append({
                "event": "payment_settled",
                "role": role,
                "wallet": addr,
                "tx_hash": result["txHash"],
                "amount": state["payment_amounts"].get(addr, 0),
            })
        if result.get("error"):
            errors.append(f"{role} ({addr[:10]}...): {result['error']}")
            print(f"[Payroll] Error for {role}: {result['error']}")

    # Log fired agents (delegation revocation is implicit — they can't spend)
    for agent in state["agents"]:
        if agent["status"] == "fired":
            economy_log.append({
                "event": "delegation_revoked",
                "agent_id": agent["agent_id"],
                "role": agent["role"],
                "budget_recovered": agent["budget"],
            })

    total_paid = sum(state["payment_amounts"].values())
    total_recovered = sum(a["budget"] for a in state["agents"] if a["status"] == "fired")
    print(
        f"[Payroll] Done. ${total_paid} paid, ${total_recovered} recovered from fired agents, "
        f"{len(tx_hashes)} txs, {len(errors)} errors"
    )

    economy_log.append({
        "event": "payroll_complete",
        "total_paid": total_paid,
        "total_recovered": total_recovered,
        "tx_count": len(tx_hashes),
    })

    return {
        "tx_hashes": tx_hashes,
        "execution_errors": errors,
        "economy_log": economy_log,
    }
