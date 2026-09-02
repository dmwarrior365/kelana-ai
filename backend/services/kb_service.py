from dotenv import load_dotenv
import boto3
import logging
import os

# Load environment
load_dotenv()

logger = logging.getLogger(__name__)

# Configuration
AWS_REGION: str = os.getenv("AWS_REGION", "ap-southeast-2")
MODEL_ID: str = os.getenv("MODEL_ID", "amazon.nova-lite-v1:0")
KNOWLEDGE_BASE_ID: str | None = os.getenv("KNOWLEDGE_BASE_ID")
KB_NUMBER_OF_RESULTS: int = int(os.getenv("KB_NUMBER_OF_RESULTS", "5"))

# Prompt template used when synthesising an answer from retrieved passages
_SYNTHESIS_PROMPT = (
    "You are a helpful travel assistant. "
    "Answer the user's question using ONLY the context passages below. "
    "If the passages do not contain enough information to answer, say so honestly. "
    "Be concise and factual.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}\n\n"
    "Answer:"
)


def _get_kb_client():
    """Bedrock Agent Runtime client — exposes the Retrieve API."""
    return boto3.client(
        service_name="bedrock-agent-runtime",
        region_name=AWS_REGION,
    )


def _get_runtime_client():
    """Bedrock Runtime client — exposes the Converse API."""
    return boto3.client(
        service_name="bedrock-runtime",
        region_name=AWS_REGION,
    )


def _require_kb_id() -> str:
    if not KNOWLEDGE_BASE_ID:
        raise ValueError(
            "KNOWLEDGE_BASE_ID is not set. "
            "Add it to your .env file and restart the server."
        )
    return KNOWLEDGE_BASE_ID


# ── Public API ────────────────────────────────────────────────────────────────

def retrieve_passages(
    question: str,
    number_of_results: int = KB_NUMBER_OF_RESULTS,
) -> list[dict]:
    """
    Retrieve raw document passages from the Knowledge Base without generation.

    Uses managedSearchConfiguration — required for managed (inline) knowledge
    bases. Returns passage dicts with keys: text, score, source, metadata.

    Args:
        question:          The natural-language query to embed and search.
        number_of_results: Maximum number of passages to return (default from env).

    Returns:
        List of dicts: [{"text": str, "score": float, "source": str, "metadata": dict}]
    """
    kb_id = _require_kb_id()
    client = _get_kb_client()

    logger.info(
        f"Retrieving passages from KB '{kb_id}' | "
        f"results={number_of_results} | question={question!r}"
    )

    response = client.retrieve(
        knowledgeBaseId=kb_id,
        retrievalQuery={"text": question},
        retrievalConfiguration={
            "managedSearchConfiguration": {
                "numberOfResults": number_of_results,
            },
        },
    )

    passages = []
    for result in response.get("retrievalResults", []):
        location = result.get("location", {})
        metadata = result.get("metadata", {})

        # Prefer the metadata source URI (always present for managed KBs),
        # then fall back through known location types.
        source = (
            metadata.get("_source_uri")
            or location.get("s3Location", {}).get("uri")
            or location.get("webLocation", {}).get("url")
            or location.get("confluenceLocation", {}).get("url")
            or location.get("sharePointLocation", {}).get("url")
            or "unknown"
        )

        # Human-readable title — prefer the stored document title over raw URI
        title = (
            metadata.get("_document_title")
            or (source.split("/")[-1] if source != "unknown" else "unknown")
        )

        passages.append(
            {
                "text":     result.get("content", {}).get("text", ""),
                "score":    result.get("score", 0.0),
                "source":   source,
                "title":    title,
                "metadata": metadata,
            }
        )

    logger.info(f"Retrieved {len(passages)} passages from Knowledge Base.")
    return passages


def ask_knowledge_base(
    question: str,
    number_of_results: int = KB_NUMBER_OF_RESULTS,
) -> tuple[str, list[dict]]:
    """
    RAG pipeline for managed Bedrock Knowledge Bases.

    Because RetrieveAndGenerate is not supported for managed KBs, this
    function performs two steps:
      1. Retrieve — fetch relevant passages via managedSearchConfiguration.
      2. Generate — send passages + question to the foundation model via Converse.

    Args:
        question:          The natural-language question to answer.
        number_of_results: How many passages to retrieve before generation.

    Returns:
        A tuple of (answer_text, sources) where sources is a deduplicated list
        of document URIs that were used to generate the answer.

    Raises:
        ValueError: If KNOWLEDGE_BASE_ID is not set.
        Exception:  Propagated from boto3 / Bedrock on API errors.
    """
    # Step 1 — retrieve relevant passages
    passages = retrieve_passages(question, number_of_results)

    if not passages:
        logger.warning(f"KB returned no passages for question: {question!r}")
        return (
            "I couldn't find relevant information in the knowledge base "
            "to answer your question.",
            [],
        )
    # Return both the display title and the full URI so the frontend can
    # render a friendly label while still having the raw reference.
    seen_uris: set[str] = set()
    sources: list[dict] = []
    for p in passages:
        uri = p["source"]
        if uri and uri != "unknown" and uri not in seen_uris:
            seen_uris.add(uri)
            sources.append({"title": p["title"], "uri": uri})

    # Step 2 — build context and synthesise an answer
    context_lines = []
    for i, p in enumerate(passages, start=1):
        source_label = p["source"].split("/")[-1] if p["source"] != "unknown" else "unknown"
        context_lines.append(f"[{i}] (source: {source_label})\n{p['text']}")
    context = "\n\n".join(context_lines)

    prompt = _SYNTHESIS_PROMPT.format(context=context, question=question)

    logger.info(
        f"Sending synthesis prompt to model '{MODEL_ID}' "
        f"({len(passages)} passage(s), {len(prompt)} chars)"
    )

    runtime = _get_runtime_client()
    response = runtime.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        inferenceConfig={
            "maxTokens": 1024,
            "temperature": 0.3,  # lower temp for factual grounded answers
        },
    )

    text_parts: list[str] = [
        block["text"]
        for block in response["output"]["message"]["content"]
        if "text" in block
    ]
    answer = "\n".join(text_parts)
    logger.info(
        f"Generated answer ({len(answer)} chars) with {len(sources)} source(s) "
        f"for question: {question!r}"
    )
    return answer, sources
