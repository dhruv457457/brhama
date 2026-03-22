from langgraph.graph import StateGraph, END
from agents.state import PactState
from agents.nodes.github_watcher import github_watcher_node
from agents.nodes.scorer import scorer_node
from agents.nodes.budget_guardian import budget_guardian_node
from agents.nodes.delegation_manager import delegation_manager_node
from agents.nodes.executor import executor_node


def build_pact_graph():
    """Build and compile the Pact agent pipeline StateGraph."""
    graph = StateGraph(PactState)

    graph.add_node("github_watcher", github_watcher_node)
    graph.add_node("scorer", scorer_node)
    graph.add_node("budget_guardian", budget_guardian_node)
    graph.add_node("delegation_manager", delegation_manager_node)
    graph.add_node("executor", executor_node)

    graph.set_entry_point("github_watcher")
    graph.add_edge("github_watcher", "scorer")
    graph.add_edge("scorer", "budget_guardian")

    # Conditional: if blocked, skip to END
    graph.add_conditional_edges(
        "budget_guardian",
        lambda state: "end" if state.get("is_blocked") else "delegation_manager",
        {"delegation_manager": "delegation_manager", "end": END},
    )

    graph.add_edge("delegation_manager", "executor")
    graph.add_edge("executor", END)

    return graph.compile()


# Pre-compiled graph instance
pact_graph = build_pact_graph()
