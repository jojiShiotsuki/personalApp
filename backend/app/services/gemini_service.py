import os
import json
import asyncio
from typing import Optional
from google import genai
from google.genai import types


# Initialize client lazily
_client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    """Get or create Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        _client = genai.Client(api_key=api_key)
    return _client


# Schema for structured lead output
LEAD_SCHEMA = types.Schema(
    type=types.Type.ARRAY,
    items=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "agency_name": types.Schema(
                type=types.Type.STRING,
                description="The name of the business or agency."
            ),
            "email": types.Schema(
                type=types.Type.STRING,
                description="Email address if found, otherwise return 'Not Listed'."
            ),
            "contact_name": types.Schema(
                type=types.Type.STRING,
                description="Name of a key contact person or founder."
            ),
            "website": types.Schema(
                type=types.Type.STRING,
                description="The official website URL."
            ),
            "niche": types.Schema(
                type=types.Type.STRING,
                description="The specific industry niche they serve."
            ),
        },
        required=["agency_name", "website"],
    ),
)


async def find_businesses(
    niche: str,
    location: str,
    count: int = 10,
    max_retries: int = 3
) -> list[dict]:
    """
    Search for businesses using Gemini with Google Search.

    Uses two-step approach: Search first, then parse to JSON.
    (Gemini doesn't support structured output with Search tool)

    Args:
        niche: Industry/service type to search for
        location: Geographic location
        count: Number of leads to find (5-15)
        max_retries: Number of retry attempts

    Returns:
        List of business lead dictionaries
    """
    client = get_client()

    # Step 1: Search for businesses using Google Search
    search_prompt = f"""Find {count} real businesses matching "{niche}" in "{location}".
IMPORTANT: If "{location}" is a country, search across its major states, provinces, or territories.
For each business, find: business name, email, contact person name, website URL, and their specific niche.
Return ONLY real businesses you can verify exist through search. Do not make up fake businesses."""

    for attempt in range(max_retries):
        try:
            # First call: Search with grounding
            search_response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=search_prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                ),
            )

            search_text = search_response.text
            if not search_text:
                raise ValueError("No data received from search")

            # Step 2: Parse results into structured JSON (no Search tool)
            parse_prompt = f"""Parse the following business information into JSON format.

Business Information:
{search_text}

Return a JSON array where each business has these fields:
- agency_name: The business name (required)
- email: Email address if found, otherwise "Not Listed"
- contact_name: Name of contact person if found, otherwise null
- website: Website URL (required)
- niche: Their specific industry/service niche

Return ONLY the JSON array, no other text."""

            parse_response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=parse_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=LEAD_SCHEMA,
                ),
            )

            text = parse_response.text
            if not text:
                raise ValueError("No data received from parser")

            try:
                data = json.loads(text)
                if isinstance(data, list):
                    return data
                raise ValueError("Response is not a list")
            except json.JSONDecodeError as e:
                raise ValueError(f"Failed to parse AI response: {e}")

        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
                continue
            raise

    return []
