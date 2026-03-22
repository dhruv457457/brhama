import httpx
from typing import Dict, List, Any


class OnchainClient:
    """HTTP client for the Node.js on-chain service."""

    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url.rstrip("/")

    async def get_remaining_allowance(self, permissions_context: str) -> float:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/permissions/allowance",
                json={"permissionsContext": permissions_context},
            )
            resp.raise_for_status()
            return resp.json()["remaining"]

    async def get_wallet_for_handle(self, github_handle: str) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/api/permissions/wallet/{github_handle}"
            )
            resp.raise_for_status()
            return resp.json()["wallet"]

    async def create_sub_delegation(
        self,
        parent_context: str,
        delegate_address: str,
        amount_usdc: float,
        delegation_manager: str = "",
    ) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/permissions/sub-delegation",
                json={
                    "parentPermissionsContext": parent_context,
                    "delegateAddress": delegate_address,
                    "amountUsdc": amount_usdc,
                    "delegationManager": delegation_manager,
                },
            )
            resp.raise_for_status()
            return resp.json()["subPermissionsContext"]

    async def execute_payments(
        self, payments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self.base_url}/api/permissions/execute-payments",
                json={"payments": payments},
            )
            resp.raise_for_status()
            return resp.json()["results"]
