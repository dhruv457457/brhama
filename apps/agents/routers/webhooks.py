from fastapi import APIRouter, Request, BackgroundTasks
import hashlib
import hmac
import os

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/github")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receive GitHub webhook events (push, PR merge)."""
    event = request.headers.get("X-GitHub-Event", "")
    payload = await request.json()

    # Verify webhook signature if secret is configured
    webhook_secret = os.getenv("GITHUB_WEBHOOK_SECRET")
    if webhook_secret:
        signature = request.headers.get("X-Hub-Signature-256", "")
        body = await request.body()
        expected = "sha256=" + hmac.new(
            webhook_secret.encode(), body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return {"error": "Invalid signature"}, 401

    if event == "pull_request" and payload.get("action") == "closed":
        pr = payload.get("pull_request", {})
        if pr.get("merged"):
            print(f"[Webhook] PR #{pr['number']} merged by {pr['user']['login']}")
            # Could trigger pipeline here, but we use the scheduler instead
            return {"status": "noted", "pr": pr["number"]}

    return {"status": "ok", "event": event}
