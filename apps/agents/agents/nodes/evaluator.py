import json
from openai import AsyncOpenAI
from agents.state import PactState
from config import settings


async def evaluator_node(state: PactState) -> dict:
    """
    CEO evaluates all worker outputs using the reviewer's scores.
    Decides final pay amounts: full pay, partial pay, or FIRE (revoke delegation).
    """
    print("[Evaluator] CEO evaluating worker performance...")

    agents = list(state["agents"])
    economy_log = list(state.get("economy_log", []))

    # Find reviewer output
    reviewer_output = None
    for agent in agents:
        if agent["role"] == "reviewer" and agent["status"] == "completed":
            reviewer_output = agent["output"]
            break

    # Parse reviewer scores
    review_scores = {}
    if reviewer_output:
        try:
            # Try to extract JSON from reviewer output
            content = reviewer_output.strip()
            if "```" in content:
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            review_data = json.loads(content)
            for review in review_data.get("reviews", []):
                role = review.get("role", "")
                review_scores[role] = {
                    "score": float(review.get("score", 5)),
                    "recommendation": review.get("recommendation", "pay"),
                    "reason": review.get("reason", ""),
                }
        except (json.JSONDecodeError, KeyError) as e:
            print(f"[Evaluator] Could not parse reviewer output, using LLM fallback: {e}")

    # If reviewer parsing failed, use CEO's own LLM evaluation
    if not review_scores:
        review_scores = await _ceo_evaluate(agents, state["user_task"])

    # Apply scores and decide pay
    payment_amounts: dict[str, float] = {}
    agent_handles: dict[str, str] = {}
    fired_agents = []
    paid_agents = []

    for i, agent in enumerate(agents):
        if agent["status"] not in ("completed", "working"):
            continue

        role = agent["role"]
        review = review_scores.get(role, {"score": 6, "recommendation": "pay", "reason": "Default"})
        score = review["score"]
        recommendation = review["recommendation"]

        agents[i] = {**agent, "quality_score": score}

        if recommendation == "fire" or score < 5:
            # FIRE — revoke delegation, pay nothing
            agents[i] = {**agent, "quality_score": score, "status": "fired", "paid_amount": 0}
            fired_agents.append(agent)
            print(
                f"[Evaluator] FIRED {role} agent — score {score}/10 — "
                f"${agent['budget']} delegation REVOKED"
            )
            economy_log.append({
                "event": "agent_fired",
                "agent_id": agent["agent_id"],
                "role": role,
                "score": score,
                "reason": review.get("reason", "Low performance"),
            })
        else:
            # PAY — proportional to score
            pay_ratio = min(score / 10.0, 1.0)
            if score >= 8:
                pay_ratio = 1.0  # Full pay for excellent work
            elif score >= 5:
                pay_ratio = score / 10.0  # Proportional

            paid_amount = round(agent["budget"] * pay_ratio, 2)
            agents[i] = {**agent, "quality_score": score, "status": "paid", "paid_amount": paid_amount}
            payment_amounts[agent["wallet_address"]] = paid_amount
            agent_handles[agent["wallet_address"]] = f"{role}_agent"
            paid_agents.append(agent)
            print(
                f"[Evaluator] PAID {role} agent — score {score}/10 — "
                f"${paid_amount} of ${agent['budget']} budget"
            )
            economy_log.append({
                "event": "agent_paid",
                "agent_id": agent["agent_id"],
                "role": role,
                "score": score,
                "budget": agent["budget"],
                "paid_amount": paid_amount,
            })

    # Score the reviewer too (auto-scored based on whether they provided useful reviews)
    for i, agent in enumerate(agents):
        if agent["role"] == "reviewer" and agent["status"] == "completed":
            reviewer_score = 8.0 if review_scores else 4.0
            paid_amount = round(agent["budget"] * (reviewer_score / 10.0), 2)
            agents[i] = {
                **agent,
                "quality_score": reviewer_score,
                "status": "paid" if reviewer_score >= 5 else "fired",
                "paid_amount": paid_amount if reviewer_score >= 5 else 0,
            }
            if reviewer_score >= 5:
                payment_amounts[agent["wallet_address"]] = paid_amount
                agent_handles[agent["wallet_address"]] = "reviewer_agent"

    total_paid = sum(payment_amounts.values())
    print(
        f"[Evaluator] Summary: {len(paid_agents)} paid, {len(fired_agents)} fired, "
        f"${total_paid} total payroll"
    )

    return {
        "agents": agents,
        "payment_amounts": payment_amounts,
        "agent_handles": agent_handles,
        "total_paid": total_paid,
        "economy_log": economy_log,
    }


async def _ceo_evaluate(agents: list, user_task: str) -> dict:
    """Fallback: CEO agent evaluates workers directly via LLM."""
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
    )

    outputs_text = ""
    for agent in agents:
        if agent["role"] == "reviewer" or agent["status"] != "completed":
            continue
        outputs_text += f"""
--- {agent['role'].upper()} AGENT ---
Task: {agent['task']}
Output (first 400 chars): {agent['output'][:400]}
---
"""

    prompt = f"""You are a CEO agent evaluating your workers' performance.
Project: "{user_task}"

Worker outputs:
{outputs_text}

Score each worker 1-10 and decide: "pay" or "fire".
Return JSON: {{"<role>": {{"score": <number>, "recommendation": "pay"|"fire", "reason": "<sentence>"}}}}"""

    try:
        response = await client.chat.completions.create(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        content = response.choices[0].message.content or "{}"
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(content)
    except Exception as e:
        print(f"[Evaluator] CEO evaluation failed: {e}")
        return {}
