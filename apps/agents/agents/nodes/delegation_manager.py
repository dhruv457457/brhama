from agents.state import PactState
from agents.tools.onchain_client import OnchainClient
from config import settings


async def delegation_manager_node(state: PactState) -> dict:
    """Create ERC-7710 sub-delegations for each contributor."""
    print("[DelegationManager] Creating sub-delegations...")

    onchain = OnchainClient(settings.onchain_service_url)
    sub_delegations: dict[str, str] = {}

    for wallet_address, amount_usdc in state["payment_amounts"].items():
        if amount_usdc <= 0:
            continue

        try:
            sub_context = await onchain.create_sub_delegation(
                parent_context=state["permissions_context"],
                delegate_address=wallet_address,
                amount_usdc=amount_usdc,
                delegation_manager=state.get("delegation_manager", ""),
            )
            sub_delegations[wallet_address] = sub_context
            print(f"[DelegationManager] Sub-delegation created for {wallet_address}: ${amount_usdc}")
        except Exception as e:
            print(f"[DelegationManager] Error for {wallet_address}: {e}")

    return {"sub_delegations": sub_delegations}
