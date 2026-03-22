import json
from openai import AsyncOpenAI


async def score_contribution(
    api_key: str,
    title: str,
    description: str,
    diff_summary: str,
) -> dict:
    """Use LLM via OpenRouter to score a contribution 1-10."""
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    prompt = f"""You are evaluating an open source contribution for payment.

PR Title: {title}
PR Description: {description}
Files changed:
{diff_summary}

Score this contribution from 1 to 10 based on:
- Impact on the project (is it critical, important, or minor?)
- Code quality signals from the diff
- Whether it's a bug fix (lower), feature (medium), or security/architecture (higher)

Return ONLY a JSON object: {{"score": <number 1-10>, "reason": "<one sentence>"}}"""

    response = await client.chat.completions.create(
        model="anthropic/claude-3.5-sonnet",
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.choices[0].message.content or '{"score": 5, "reason": "default"}'

    # Parse JSON from response (handle potential markdown wrapping)
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    return json.loads(content)
