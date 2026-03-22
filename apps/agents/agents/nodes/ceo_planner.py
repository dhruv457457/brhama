import json
from openai import AsyncOpenAI
from agents.state import PactState
from config import settings


async def ceo_planner_node(state: PactState) -> dict:
    """
    CEO Agent — analyzes user's task and decides which worker agents to hire.
    Allocates budget across workers and assigns specific tasks.
    Hires diverse, specialized roles for maximum value.
    """
    print("[CEO] Analyzing task and planning team...")

    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
    )

    budget = state["budget_usdc"]
    user_task = state["user_task"]

    prompt = f"""You are a CEO agent managing an autonomous AI company.
A human has given you ONE task and a budget. You must build the BEST team to deliver maximum value.

You run a company with specialized departments. Hire the right specialists:

Available agent roles (choose the BEST mix for this task):
- analyst: Deep-dive data analysis, market research, technical evaluation, competitive intelligence
- strategist: Business strategy, investment recommendations, go-to-market plans, risk-reward frameworks
- engineer: Writes code, smart contracts, scripts, technical implementations, architecture designs
- writer: Produces polished reports, executive summaries, pitch decks, documentation
- risk_officer: Identifies risks, red flags, failure modes, regulatory concerns, attack vectors
- reviewer: Reviews and QA-checks all other agents' work quality, catches errors and inconsistencies

IMPORTANT RULES FOR DIVERSE HIRING:
- Do NOT hire the same role twice. Each agent must be a DIFFERENT role.
- Hire 3-5 agents with DIFFERENT specialties to get multiple perspectives.
- Always hire a reviewer as the final quality gate.
- Allocate budgets based on task difficulty: harder tasks = higher budget.
- Keep ~10% reserve for unexpected costs.
- Each agent's budget is their maximum pay — actual pay depends on performance score.
- Agents scoring below 5/10 get FIRED (delegation revoked, $0 pay).

User's task: "{user_task}"
Total budget: ${budget} USDC

Return a JSON object:
{{"plan": [{{"role": "<role>", "task": "<specific, detailed task description>", "budget": <number>}}], "reasoning": "<1-2 sentences on why you chose this team structure and how each role adds unique value>", "reserve": <number>}}

CRITICAL: Each agent in the plan must have a UNIQUE role. Never repeat roles."""

    response = await client.chat.completions.create(
        model="anthropic/claude-3.5-sonnet",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    content = response.choices[0].message.content or "{}"
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    result = json.loads(content)
    plan = result.get("plan", [])
    reasoning = result.get("reasoning", "")

    # Build agent workers from plan
    agents = []
    total_allocated = 0
    seen_roles = set()

    for i, worker in enumerate(plan):
        role = worker["role"]

        # Deduplicate roles — append index if repeated
        if role in seen_roles:
            role = f"{role}_{i}"
        seen_roles.add(role)

        task = worker["task"]
        worker_budget = float(worker["budget"])
        total_allocated += worker_budget

        # Generate deterministic wallet address for this agent
        agent_id = f"agent_{role}_{i}"
        addr_hex = hex(hash(f"{agent_id}_{state['permissions_context'][:20]}") & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        wallet = f"0x{addr_hex[2:].zfill(40)}"

        agents.append({
            "agent_id": agent_id,
            "role": role,
            "task": task,
            "budget": worker_budget,
            "status": "spawned",
            "output": "",
            "quality_score": 0.0,
            "paid_amount": 0.0,
            "wallet_address": wallet,
            "sub_delegation": "",
        })

        print(f"[CEO] Hired {role} agent — budget ${worker_budget} — task: {task[:60]}...")

    print(f"[CEO] Team of {len(agents)} agents, ${total_allocated} allocated of ${budget}")

    economy_log = state.get("economy_log", [])
    economy_log.append({
        "event": "team_planned",
        "agents_hired": len(agents),
        "total_allocated": total_allocated,
        "reasoning": reasoning,
    })

    return {
        "ceo_plan": result,
        "ceo_reasoning": reasoning,
        "agents": agents,
        "total_allocated": total_allocated,
        "economy_log": economy_log,
    }
