from pydantic import BaseModel
from typing import Optional


class ContributionModel(BaseModel):
    pr_number: int
    title: str
    description: str
    diff_summary: str
    author_handle: str
    author_wallet: Optional[str] = None
    merged_at: str


class ScoreResult(BaseModel):
    score: float
    reason: str
