from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    github_token: str = ""
    github_repo: str = "owner/repo"
    onchain_service_url: str = "http://localhost:3001"
    permissions_context: str = ""
    budget_usdc: float = 500.0
    period_days: int = 30
    scheduler_interval_minutes: int = 10080  # 7 days

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
