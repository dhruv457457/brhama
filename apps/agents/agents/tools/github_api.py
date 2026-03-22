import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any


async def fetch_merged_prs(
    repo_owner: str,
    repo_name: str,
    github_token: str,
    days: int = 7,
) -> List[Dict[str, Any]]:
    """Fetch PRs merged in the last N days."""
    headers = {
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }
    since = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"

    async with httpx.AsyncClient() as client:
        url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls"
        params = {"state": "closed", "sort": "updated", "direction": "desc", "per_page": 50}
        resp = await client.get(url, headers=headers, params=params)
        resp.raise_for_status()
        prs = resp.json()

        merged_prs = [
            pr for pr in prs
            if pr.get("merged_at") and pr["merged_at"] > since
        ]

        contributions = []
        for pr in merged_prs:
            # Fetch changed files
            files_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls/{pr['number']}/files"
            files_resp = await client.get(files_url, headers=headers)
            files_resp.raise_for_status()
            files = files_resp.json()

            diff_summary = "\n".join(
                f"{f['filename']}: +{f.get('additions', 0)} -{f.get('deletions', 0)}"
                for f in files[:15]
            )

            contributions.append({
                "pr_number": pr["number"],
                "title": pr["title"],
                "description": pr.get("body") or "",
                "diff_summary": diff_summary,
                "author_handle": pr["user"]["login"],
                "merged_at": pr["merged_at"],
            })

        return contributions
