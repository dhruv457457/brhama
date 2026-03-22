from pydantic import BaseModel
from typing import Dict, List, Optional


class RewardDistribution(BaseModel):
    scores: Dict[str, float]
    weights: Dict[str, float]
    payment_amounts: Dict[str, float]


class PaymentResult(BaseModel):
    contributor_address: str
    amount_usdc: float
    tx_hash: Optional[str] = None
    error: Optional[str] = None


class PipelineResult(BaseModel):
    run_id: str
    status: str
    scores: Dict[str, float] = {}
    payment_amounts: Dict[str, float] = {}
    tx_hashes: Dict[str, str] = {}
    execution_errors: List[str] = []
    is_blocked: bool = False
