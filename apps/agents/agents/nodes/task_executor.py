import json
from openai import AsyncOpenAI
from agents.state import PactState
from config import settings


async def task_executor_node(state: PactState) -> dict:
    """
    Each worker agent executes their assigned task using LLM.
    Each role gets a specialized prompt that maximizes output quality.
    """
    print("[TaskExecutor] Worker agents executing tasks...")

    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
    )

    agents = list(state["agents"])
    economy_log = list(state.get("economy_log", []))

    # Collect all non-reviewer outputs first (reviewers need to see them)
    worker_outputs = {}

    # Phase 1: Execute non-reviewer agents
    for i, agent in enumerate(agents):
        if agent["status"] != "working" or agent["role"] == "reviewer":
            continue

        print(f"[TaskExecutor] {agent['role']} agent working on: {agent['task'][:60]}...")

        prompt = _build_worker_prompt(agent, state["user_task"])

        try:
            response = await client.chat.completions.create(
                model="anthropic/claude-3.5-sonnet",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
            )
            output = response.choices[0].message.content or ""
            agents[i] = {**agent, "output": output, "status": "completed"}
            worker_outputs[agent["agent_id"]] = {
                "role": agent["role"],
                "task": agent["task"],
                "output": output[:500],
            }
            print(f"[TaskExecutor] {agent['role']} agent completed — {len(output)} chars output")
            economy_log.append({
                "event": "task_completed",
                "agent_id": agent["agent_id"],
                "role": agent["role"],
                "output_length": len(output),
            })
        except Exception as e:
            print(f"[TaskExecutor] {agent['role']} agent failed: {e}")
            agents[i] = {**agent, "output": f"FAILED: {str(e)}", "status": "failed"}
            economy_log.append({
                "event": "task_failed",
                "agent_id": agent["agent_id"],
                "role": agent["role"],
                "error": str(e),
            })

    # Phase 2: Execute reviewer agents (they can see other outputs)
    for i, agent in enumerate(agents):
        if agent["status"] != "working" or agent["role"] != "reviewer":
            continue

        print(f"[TaskExecutor] reviewer agent reviewing outputs...")

        review_prompt = _build_reviewer_prompt(agent, worker_outputs, state["user_task"])

        try:
            response = await client.chat.completions.create(
                model="anthropic/claude-3.5-sonnet",
                messages=[{"role": "user", "content": review_prompt}],
                temperature=0.2,
            )
            output = response.choices[0].message.content or ""
            agents[i] = {**agent, "output": output, "status": "completed"}
            print(f"[TaskExecutor] reviewer completed — {len(output)} chars")
            economy_log.append({
                "event": "review_completed",
                "agent_id": agent["agent_id"],
                "output_length": len(output),
            })
        except Exception as e:
            print(f"[TaskExecutor] reviewer failed: {e}")
            agents[i] = {**agent, "output": f"FAILED: {str(e)}", "status": "failed"}

    return {"agents": agents, "economy_log": economy_log}


def _build_worker_prompt(agent: dict, user_task: str) -> str:
    """Build a role-specific prompt for the worker agent."""

    base_role = agent["role"].split("_")[0]  # Handle deduplicated roles like "analyst_2"

    role_prompts = {
        "analyst": f"""You are a Senior Analyst hired by a CEO agent. You're being paid ${agent['budget']} USDC for this work.

YOUR ASSIGNMENT: {agent['task']}
PROJECT CONTEXT: {user_task}

Produce a deep, data-driven analysis report. Your report MUST include:
- Quantitative metrics and specific data points (TVL, volumes, market share, growth rates)
- Technical architecture breakdown with specific protocols, contracts, and mechanisms
- Competitive landscape with named competitors and specific comparisons
- Data tables or structured comparisons where relevant
- Clear conclusion with evidence-based reasoning

CRITICAL: Generic surface-level analysis = score below 5 = YOU GET FIRED (delegation revoked, $0 pay).
Specific technical depth with real data = score 8+ = FULL PAY.
Your reputation and payment depend on the quality of this work.""",

        "strategist": f"""You are a Chief Strategist hired by a CEO agent. You're being paid ${agent['budget']} USDC for this work.

YOUR ASSIGNMENT: {agent['task']}
PROJECT CONTEXT: {user_task}

Produce a strategic recommendation with clear decision framework. You MUST include:
- Executive summary with clear BUY/PASS/WAIT recommendation
- Strategic rationale backed by market data and competitive positioning
- Risk-reward matrix with probability-weighted scenarios
- Timeline and milestones for the recommended strategy
- Key metrics to monitor and decision triggers
- Counter-arguments to your own recommendation (steel-man the opposing view)

CRITICAL: Vague strategy with no data = score below 5 = YOU GET FIRED.
Specific, actionable strategy with evidence = score 8+ = FULL PAY.""",

        "engineer": f"""You are a Lead Engineer hired by a CEO agent. You're being paid ${agent['budget']} USDC for this work.

YOUR ASSIGNMENT: {agent['task']}
PROJECT CONTEXT: {user_task}

Write clean, production-ready code or technical design. You MUST include:
- Full implementation with inline comments explaining decisions
- Error handling and edge cases
- Architecture rationale (why this approach vs alternatives)
- Test cases or validation logic
- Gas optimization notes (if blockchain-related)
- Security considerations

CRITICAL: Sloppy code or hand-wavy pseudocode = score below 5 = YOU GET FIRED.
Production-quality implementation = score 8+ = FULL PAY.""",

        "writer": f"""You are an Executive Writer hired by a CEO agent. You're being paid ${agent['budget']} USDC for this work.

YOUR ASSIGNMENT: {agent['task']}
PROJECT CONTEXT: {user_task}

Produce a polished, executive-quality document. You MUST include:
- Clear structure with numbered sections and headers
- Executive summary (3-5 bullet points for busy executives)
- Detailed body with evidence, data points, and analysis
- Professional tone suitable for board presentations
- Visual formatting (use tables, bullet lists, bold for emphasis)
- Conclusion with specific next steps

CRITICAL: Rambling unfocused writing = score below 5 = YOU GET FIRED.
Clear, structured, persuasive writing = score 8+ = FULL PAY.""",

        "risk_officer": f"""You are a Chief Risk Officer hired by a CEO agent. You're being paid ${agent['budget']} USDC for this work.

YOUR ASSIGNMENT: {agent['task']}
PROJECT CONTEXT: {user_task}

Produce a comprehensive risk assessment. You MUST include:
- Risk matrix: list every risk with probability (1-5) and impact (1-5) scores
- Technical risks: smart contract vulnerabilities, oracle failures, bridge exploits
- Market risks: liquidity, competition, regulatory, macro
- Operational risks: team, governance, centralization vectors
- Red flags: specific concerns that could be deal-breakers
- Mitigation strategies for each high-priority risk
- Overall risk rating: LOW / MEDIUM / HIGH / CRITICAL

CRITICAL: Missing obvious risks = score below 5 = YOU GET FIRED.
Thorough risk identification with mitigations = score 8+ = FULL PAY.""",

        "researcher": f"""You are a Research Agent hired by a CEO agent. You're being paid ${agent['budget']} USDC for this work.

YOUR ASSIGNMENT: {agent['task']}
PROJECT CONTEXT: {user_task}

Produce a comprehensive research report. Include:
- Key findings with specific data points
- Sources and references
- Actionable recommendations
- Risk assessment

CRITICAL: Your output quality will be scored 1-10. Your pay depends on your score.
If you score below 5, your delegation will be REVOKED (you get fired).
Deliver excellent work.""",

        "coder": f"""You are a Coder Agent hired by a CEO agent. You're being paid ${agent['budget']} USDC for this work.

YOUR ASSIGNMENT: {agent['task']}
PROJECT CONTEXT: {user_task}

Write clean, production-ready code. Include:
- Full implementation with comments
- Error handling
- Brief explanation of architecture decisions
- Test cases or validation logic

CRITICAL: Your output quality will be scored 1-10. Your pay depends on your score.
If you score below 5, your delegation will be REVOKED (you get fired).
Deliver excellent work.""",

        "executor": f"""You are an Executor Agent hired by a CEO agent. You're being paid ${agent['budget']} USDC for this work.

YOUR ASSIGNMENT: {agent['task']}
PROJECT CONTEXT: {user_task}

Produce a detailed execution plan with:
- Step-by-step deployment/execution instructions
- Parameters and configurations
- Validation checks at each step
- Rollback plan if something goes wrong

CRITICAL: Your output quality will be scored 1-10. Your pay depends on your score.
If you score below 5, your delegation will be REVOKED (you get fired).
Deliver excellent work.""",
    }

    return role_prompts.get(base_role, f"""You are a {agent['role']} Agent hired by a CEO agent. You're being paid ${agent['budget']} USDC.

YOUR ASSIGNMENT: {agent['task']}
PROJECT CONTEXT: {user_task}

Deliver excellent, detailed, specific work. Your pay depends on your quality score (1-10).
Score below 5 = FIRED (delegation revoked, $0). Score 8+ = FULL PAY.
Generic or surface-level work will get you fired.""")


def _build_reviewer_prompt(reviewer: dict, outputs: dict, user_task: str) -> str:
    """Build review prompt with all worker outputs."""
    outputs_text = ""
    for agent_id, data in outputs.items():
        outputs_text += f"""
--- {data['role'].upper()} AGENT ---
Task: {data['task']}
Output (first 500 chars):
{data['output']}
---
"""

    return f"""You are a Senior Reviewer & QA Agent hired by a CEO agent.
Your job: {reviewer['task']}

The CEO hired several specialized agents for this project:
"{user_task}"

Here are their outputs to review:
{outputs_text}

REVIEW CRITERIA (score each 1-10):
- Specificity: Does the output contain specific data, metrics, and evidence? (not vague generalities)
- Accuracy: Are claims technically correct and well-reasoned?
- Completeness: Does it fully address the assigned task?
- Actionability: Can the CEO use this output to make decisions?
- Quality: Is it well-structured, clear, and professional?

SCORING GUIDE:
- 9-10: Exceptional. Specific data, deep analysis, genuinely useful. Recommend FULL PAY.
- 7-8: Good. Solid work with some specifics. Recommend PAY (proportional).
- 5-6: Mediocre. Too generic, missing depth. Recommend PARTIAL PAY.
- 1-4: Poor. Generic, inaccurate, or lazy. Recommend FIRE.

BE RUTHLESS. The CEO is paying real money. Only reward agents who deliver genuine value.

Return a JSON object:
{{"reviews": [{{"agent_id": "<id>", "role": "<role>", "score": <1-10>, "strengths": "<specific strengths>", "weaknesses": "<specific weaknesses>", "recommendation": "pay" or "fire", "reason": "<one sentence justification>"}}], "overall_assessment": "<summary of team performance and value delivered>"}}"""
