const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
const ASK_URL = `${API_BASE}/v1/ask`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KBSource {
  title: string;
  uri: string;
}

export interface AskResponse {
  question: string;
  answer: string;
  /** Deduplicated sources from the KB passages used to generate the answer. */
  sources: KBSource[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? body?.message ?? message;
    } catch {
      // ignore parse error; use default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a question to the backend, which retrieves relevant passages from the
 * Bedrock Knowledge Base and returns a grounded answer.
 *
 * AWS credentials never leave the backend — the frontend only calls this endpoint.
 */
export async function askKnowledgeBase(question: string): Promise<AskResponse> {
  const res = await fetch(ASK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return handleResponse<AskResponse>(res);
}
