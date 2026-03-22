from agents.state import PactState
from agents.tools.onchain_client import OnchainClient
from config import settings


async def executor_node(state: PactState) -> dict:
    """Execute USDC transfers via ERC-7715 delegations."""
    print("[Executor] Executing payments...")

    onchain = OnchainClient(settings.onchain_service_url)

    # Build payment requests
    payments = []
    delegation_manager = state.get("delegation_manager", "")
    for wallet_address, sub_context in state["sub_delegations"].items():
        amount = state["payment_amounts"].get(wallet_address, 0)
        if amount <= 0:
            continue
        payments.append({
            "contributorAddress": wallet_address,
            "amountUsdc": amount,
            "aiScore": state["scores"].get(wallet_address, 0),
            "permissionsContext": sub_context,
            "delegationManager": delegation_manager,
        })

    if not payments:
        print("[Executor] No payments to execute")
        return {"tx_hashes": {}, "execution_errors": []}

    try:
        results = await onchain.execute_payments(payments)
    except Exception as e:
        print(f"[Executor] Batch execution failed: {e}")
        return {
            "tx_hashes": {},
            "execution_errors": [str(e)],
        }

    tx_hashes = {}
    errors = []
    for result in results:
        addr = result["contributorAddress"]
        if result.get("txHash"):
            tx_hashes[addr] = result["txHash"]
            print(f"[Executor] Paid {addr}: tx {result['txHash']}")
        if result.get("error"):
            errors.append(f"{addr}: {result['error']}")
            print(f"[Executor] Error for {addr}: {result['error']}")

    print(f"[Executor] Done. {len(tx_hashes)} payments, {len(errors)} errors")
    return {"tx_hashes": tx_hashes, "execution_errors": errors}
