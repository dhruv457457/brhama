from typing import TypedDict, List, Dict, Any


class Contribution(TypedDict):
    pr_number: int
    title: str
    description: str
    diff_summary: str
    author_handle: str
    author_wallet: str
    merged_at: str


class PactState(TypedDict):
    # Project context
    repo_owner: str
    repo_name: str
    budget_usdc: float
    period_days: int

    # Permission context from MetaMask
    permissions_context: str
    delegation_manager: str
    agent_wallet_address: str

    # Contribution data (written by GitHub Watcher)
    raw_contributions: List[Contribution]

    # Scores (written by Scorer agent)
    scores: Dict[str, float]

    # Payment weights (computed from scores)
    weights: Dict[str, float]
    payment_amounts: Dict[str, float]

    # Guard state (written by Budget Guardian)
    period_spent: float
    is_blocked: bool

    # Sub-delegations (written by Delegation Manager)
    sub_delegations: Dict[str, str]

    # Address → GitHub handle mapping (written by Scorer)
    contributor_handles: Dict[str, str]

    # Execution results (written by Executor)
    tx_hashes: Dict[str, str]
    execution_errors: List[str]
