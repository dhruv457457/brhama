from agents.state import PactState
from agents.tools.onchain_client import OnchainClient
from config import settings


async def agent_spawner_node(state: PactState) -> dict:
    """
    Spawns worker agents by creating ERC-7715 sub-delegations for each.
    Each agent gets a scoped budget — their "salary" — enforced on-chain.
    """
    print("[AgentSpawner] Creating sub-delegations for worker agents...")

    onchain = OnchainClient(settings.onchain_service_url)
    agents = list(state["agents"])
    sub_delegations: dict[str, str] = {}
    economy_log = list(state.get("economy_log", []))

    for i, agent in enumerate(agents):
        try:
            sub_context = await onchain.create_sub_delegation(
                parent_context=state["permissions_context"],
                delegate_address=agent["wallet_address"],
                amount_usdc=agent["budget"],
                delegation_manager=state.get("delegation_manager", ""),
            )
            agents[i] = {**agent, "sub_delegation": sub_context, "status": "working"}
            sub_delegations[agent["wallet_address"]] = sub_context
            print(
                f"[AgentSpawner] {agent['role']} agent ({agent['wallet_address'][:10]}...) "
                f"— sub-delegation created: ${agent['budget']}"
            )
            economy_log.append({
                "event": "agent_funded",
                "agent_id": agent["agent_id"],
                "role": agent["role"],
                "budget": agent["budget"],
                "wallet": agent["wallet_address"],
            })
        except Exception as e:
            print(f"[AgentSpawner] Failed to fund {agent['role']}: {e}")
            agents[i] = {**agent, "status": "failed"}
            economy_log.append({
                "event": "agent_fund_failed",
                "agent_id": agent["agent_id"],
                "role": agent["role"],
                "error": str(e),
            })

    funded = sum(1 for a in agents if a["status"] == "working")
    print(f"[AgentSpawner] {funded}/{len(agents)} agents funded and working")

    return {
        "agents": agents,
        "sub_delegations": sub_delegations,
        "economy_log": economy_log,
    }
