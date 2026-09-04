from dotenv import load_dotenv
import boto3
import logging
import os

# Load Environment
load_dotenv()

logger = logging.getLogger(__name__)

# Configuration
AWS_BEARER_TOKEN_BEDROCK: str | None = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
AWS_REGION: str = os.getenv("AWS_REGION", "ap-southeast-2")
MODEL_ID: str = os.getenv("MODEL_ID", "amazon.nova-lite-v1:0")
MAX_TOKENS: int = int(os.getenv("BEDROCK_MAX_TOKENS", "5000"))

# How the total budget is split, per trip category. Values are percentages and
# must sum to 100. Computed in Python rather than asked of the model — small models
# reliably produce tables whose rows do not add up to their own total.
BUDGET_ALLOCATION: dict[str, list[tuple[str, int]]] = {
    "Backpacker": [
        ("Accommodation",             30),
        ("Food & Drink",              25),
        ("Transport (local)",         15),
        ("Activities & Entrance Fees",15),
        ("Shopping & Souvenirs",       5),
        ("Buffer / Contingency",      10),
    ],
    "Standard": [
        ("Accommodation",             35),
        ("Food & Drink",              25),
        ("Transport (local)",         12),
        ("Activities & Entrance Fees",13),
        ("Shopping & Souvenirs",       5),
        ("Buffer / Contingency",      10),
    ],
    "Luxury": [
        ("Accommodation",             45),
        ("Food & Drink",              22),
        ("Transport (local)",         10),
        ("Activities & Entrance Fees",10),
        ("Shopping & Souvenirs",       3),
        ("Buffer / Contingency",      10),
    ],
}


def build_budget_table(budget: float, category: str | None) -> str:
    """
    Builds the budget breakdown table with exact arithmetic: the rows always sum
    to the total, and the total never exceeds `budget`. The model is asked to
    reproduce this verbatim and only fill in the Notes column.
    """
    rows = BUDGET_ALLOCATION.get(category or "", BUDGET_ALLOCATION["Standard"])

    # Round each row down, then hand any rounding remainder to the buffer row so
    # the column adds up to the total exactly.
    amounts = [round(budget * pct / 100, 2) for _, pct in rows]
    amounts[-1] = round(amounts[-1] + (budget - sum(amounts)), 2)

    lines = [
        "| Category | Estimated Cost (USD) | % of Budget | Notes |",
        "|---|---|---|---|",
    ]
    for (name, pct), amount in zip(rows, amounts):
        lines.append(f"| {name} | {amount:,.2f} | {pct}% | [your note] |")
    lines.append(f"| **Total** | **{budget:,.2f}** | **100%** | |")
    return "\n".join(lines)


TRAVEL_PLANNER_PROMPT = (
    "You are an experienced travel planner.\n"
    "Create a detailed {days}-day travel itinerary for {destination}.\n\n"
    "## Trip Details\n"
    "- Travel Month: {travel_month} ({travel_season})\n"
    "- Total Budget: USD {budget} (USD {daily_budget}/day)\n"
    "- Trip Category: {category}\n"
    "- Travel Style: {travel_style}\n"
    "- Recommended Transport: {recommendation_transport}\n\n"
    "## Output Structure\n"
    "Produce the following four sections, in this exact order, using the exact\n"
    "headings shown so the response can be parsed reliably.\n\n"
    "## Daily Itinerary\n"
    "Render each day as a SELF-CONTAINED CARD. Every day must repeat the full card\n"
    "structure below — never merge days, never write 'same as Day 1', and never\n"
    "reference another day. A reader seeing one card alone must still know what to do.\n\n"
    "### Day X: [Theme or Focus of the Day]\n\n"
    "**Daily Budget:** USD [amount for this day]\n\n"
    "**Morning:**\n"
    "- List exactly 2-3 specific morning activities (e.g. breakfast spots, scenic walks, landmarks).\n\n"
    "**Afternoon:**\n"
    "- Include at least 1 cultural site or local experience (museum, temple, market, workshop).\n"
    "- Add 1-2 additional afternoon activities suited to the travel style.\n\n"
    "**Evening:**\n"
    "- Recommend 1 specific dinner spot that fits the budget and travel style.\n"
    "- Suggest 1 nightlife or evening entertainment option (night market, bar, show, or relaxation).\n\n"
    "**Getting Around:** One line on how to move between the day's stops.\n\n"
    "**Day Tip:** One practical tip specific to this day's plan.\n\n"
    "Repeat that card for all {days} days — Day 1 through Day {days}.\n\n"
    "## Local Food Recommendations\n"
    "Recommend 5-6 dishes or drinks that are genuinely local to {destination}.\n"
    "For each one use this format on a single bullet:\n"
    "- **[Dish Name]** — what it is, where to try it (a specific stall, market or\n"
    "  restaurant), and the typical price in USD.\n"
    "Include at least one budget street-food option and one sit-down option.\n"
    "Note any common allergen or dietary caveat (pork, shellfish, peanuts, very spicy).\n\n"
    "## Estimated Budget Breakdown\n"
    "Reproduce the table below EXACTLY as given. Do not change any category name,\n"
    "cost or percentage, do not add or remove rows, and do not recalculate anything —\n"
    "the figures are already correct. Replace ONLY each '[your note]' placeholder with\n"
    "a short note specific to {destination} (e.g. typical nightly rate, transit pass\n"
    "name, what the shopping budget realistically buys).\n\n"
    "{budget_table}\n\n"
    "After the table, add one line exactly: '**Per day:** USD {daily_budget}'.\n\n"
    "## Travel Tips\n"
    "Provide 6-8 practical tips as bullets, covering at least:\n"
    "- Seasonal advice for {travel_month} ({travel_season}) — weather, crowds, what to pack.\n"
    "- Local transport and how to pay for it.\n"
    "- Money: cash vs card, tipping norms, rough exchange guidance.\n"
    "- Culture and etiquette: dress codes, greetings, temple or religious-site rules.\n"
    "- Safety and health: common scams, emergency number, tap water.\n"
    "- Connectivity: SIM card or eSIM, useful local apps.\n\n"
    "## Additional Rules\n"
    "- Keep all recommendations within the daily budget of USD {daily_budget}.\n"
    "- Tailor suggestions to the trip category: {category}.\n"
    "- Account for the travel season ({travel_season}) — mention any seasonal tips or warnings.\n"
    "- Name real, specific places rather than generic descriptions like 'a local cafe'.\n"
    "- Use markdown formatting throughout: ## for sections, ### for days, ** for bold labels,\n"
    "  - for bullet points, and a pipe table for the budget breakdown.\n"
    "- Do not add any preamble or closing commentary outside the four sections above.\n"
)

def get_bedrock_client():
    """
    Creates and returns a Bedrock runtime boto3 client.
    """
    if not AWS_BEARER_TOKEN_BEDROCK:
        raise ValueError(
            "AWS_BEARER_TOKEN_BEDROCK is not set. "
            "Check your .env file."
        )

    client = boto3.client(
        service_name="bedrock-runtime",
        region_name=AWS_REGION,
    )
    return client  # fix: was missing return

def get_ai_recommendations(
    destination: str,
    days: int,
    budget: float,
    travel_style: str,
    travel_month: str | None = None,
    travel_season: str | None = None,
    category: str | None = None,
    daily_budget: float | None = None,
    recommendation_transport: str | None = None,
) -> str:
    """
    Call Amazon Bedrock with the travel-planner prompt and return
    the AI-generated itinerary as a plain string.

    Args:
        destination:              City / country the traveller is visiting.
        days:                     Length of the trip in days.
        budget:                   Total budget in USD.
        travel_style:             Free text style description (e.g. "backpacker", "luxury").
        travel_month:             Month of travel (e.g. "June" or "6").
        travel_season:            Computed season (e.g. "Peak Season").
        category:                 Trip category (e.g. "Standard").
        daily_budget:             Computed daily budget in USD.
        recommendation_transport: Recommended transport mode.

    Returns:
        The model's text response.

    Raises:
        ValueError: If required environment variables are missing.
        Exception:  Propagated from boto3 / Bedrock on API errors.
    """
    prompt: str = TRAVEL_PLANNER_PROMPT.format(
        days                     = days,
        destination              = destination,
        budget                   = budget,
        travel_style             = travel_style,
        travel_month             = travel_month or "Not specified",
        travel_season            = travel_season or "Not specified",
        category                 = category or "Not specified",
        daily_budget             = f"{daily_budget:.2f}" if daily_budget else "Not specified",
        recommendation_transport = recommendation_transport or "Not specified",
        budget_table             = build_budget_table(budget, category),
    )

    client = get_bedrock_client()

    # Send the prompt using the Converse API.
    # maxTokens is generous: four sections plus one card per day is a long response,
    # and the budget table sits at the end where truncation would hurt most.
    response = client.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        inferenceConfig={
            "maxTokens": MAX_TOKENS,
            "temperature": 0.7,
        },
    )

    if response.get("stopReason") == "max_tokens":
        logger.warning(
            f"Bedrock response hit the {MAX_TOKENS}-token cap for {destination} "
            f"({days} days) — the itinerary may be truncated."
        )

    # Extract the assistant's reply text
    output_message = response["output"]["message"]
    text_parts: list[str] = [  # fix: list[Unknown] → list[str]
        block["text"]
        for block in output_message["content"]
        if "text" in block
    ]
    return "\n".join(text_parts)


# ─── CHAT CONVERSE ────────────────────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = (
    "You are Kelana, a friendly and knowledgeable AI travel assistant. "
    "Help users plan trips, discover destinations, estimate budgets, and find local experiences. "
    "Be concise, practical, and warm. When you don't know something, say so honestly. "
    "Always tailor your advice to the user's stated budget and travel style when provided."
)


def chat_converse(
    messages: list[dict],
    system_prompt: str = CHAT_SYSTEM_PROMPT,
    max_tokens: int = 1024,
    temperature: float = 0.7,
) -> str:
    """
    Send a multi-turn conversation to Bedrock using the Converse API.

    Args:
        messages:      List of dicts in Bedrock Converse format:
                       [{"role": "user"|"assistant", "content": [{"text": str}]}, ...]
                       Must start with a "user" turn and alternate roles.
        system_prompt: System-level instruction injected before the conversation.
        max_tokens:    Maximum tokens for the assistant reply.
        temperature:   Sampling temperature (0.0 = deterministic, 1.0 = creative).

    Returns:
        The assistant's reply as a plain string.

    Raises:
        ValueError: If required environment variables are missing.
        Exception:  Propagated from boto3 / Bedrock on API errors.
    """
    client = get_bedrock_client()

    response = client.converse(
        modelId=MODEL_ID,
        system=[{"text": system_prompt}],
        messages=messages,
        inferenceConfig={
            "maxTokens": max_tokens,
            "temperature": temperature,
        },
    )

    if response.get("stopReason") == "max_tokens":
        logger.warning(
            f"chat_converse: response hit the {max_tokens}-token cap — reply may be truncated."
        )

    text_parts: list[str] = [
        block["text"]
        for block in response["output"]["message"]["content"]
        if "text" in block
    ]
    return "\n".join(text_parts)
