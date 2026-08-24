from dotenv import load_dotenv
import boto3
import os

# Load Environment
load_dotenv()

# Configuration
AWS_BEARER_TOKEN_BEDROCK: str | None = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
AWS_REGION: str = os.getenv("AWS_REGION", "ap-southeast-2")
MODEL_ID: str = os.getenv("MODEL_ID", "amazon.nova-lite-v1:0")

TRAVEL_PLANNER_PROMPT = (
    "You are an experienced travel planner.\n"
    "Create a detailed {days}-day travel itinerary for {destination}.\n\n"
    "## Trip Details\n"
    "- Travel Month: {travel_month} ({travel_season})\n"
    "- Total Budget: USD {budget} (USD {daily_budget}/day)\n"
    "- Trip Category: {category}\n"
    "- Travel Style: {travel_style}\n"
    "- Recommended Transport: {recommendation_transport}\n\n"
    "## Instructions\n"
    "For EACH day, provide a structured daily plan using the following format:\n\n"
    "### Day X: [Theme or Focus of the Day]\n\n"
    "**Morning:**\n"
    "- List exactly 2-3 specific morning activities (e.g. breakfast spots, scenic walks, landmarks).\n\n"
    "**Afternoon:**\n"
    "- Include at least 1 cultural site or local experience (museum, temple, market, workshop).\n"
    "- Add 1-2 additional afternoon activities suited to the travel style.\n\n"
    "**Evening:**\n"
    "- Recommend 1 specific dinner spot that fits the budget and travel style.\n"
    "- Suggest 1 nightlife or evening entertainment option (night market, bar, show, or relaxation).\n\n"
    "## Additional Rules\n"
    "- Keep all recommendations within the daily budget of USD {daily_budget}.\n"
    "- Tailor suggestions to the trip category: {category}.\n"
    "- Account for the travel season ({travel_season}) — mention any seasonal tips or warnings.\n"
    "- Use markdown formatting throughout: ## for sections, ### for days, ** for bold labels, - for bullet points.\n"
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
    )

    client = get_bedrock_client()

    # Send the prompt using the Converse API
    response = client.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
    )

    # Extract the assistant's reply text
    output_message = response["output"]["message"]
    text_parts: list[str] = [  # fix: list[Unknown] → list[str]
        block["text"]
        for block in output_message["content"]
        if "text" in block
    ]
    return "\n".join(text_parts)
