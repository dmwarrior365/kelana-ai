import { getStoredToken } from "@/services/authService";
import type {
  Conversation,
  ConversationDetail,
  SendMessageResponse,
} from "@/types/conversation";

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE   = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
const CONV_URL   = `${API_BASE}/v1/conversations`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? body?.message ?? message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getStoredToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** List all conversations for the current user, newest first. */
export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(CONV_URL, {
    cache: "no-store",
    headers: authHeaders(),
  });
  return handleResponse<Conversation[]>(res);
}

/**
 * Create a new conversation.
 * Pass `firstMessage` to auto-derive the title from the first user message.
 */
export async function createConversation(opts?: {
  title?: string;
  firstMessage?: string;
}): Promise<{ conversation_id: number }> {
  const res = await fetch(CONV_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      title:         opts?.title        ?? null,
      first_message: opts?.firstMessage ?? null,
    }),
  });
  return handleResponse<{ conversation_id: number }>(res);
}

/** Fetch a single conversation with its full message history. */
export async function getConversation(id: number): Promise<ConversationDetail> {
  const res = await fetch(`${CONV_URL}/${id}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  return handleResponse<ConversationDetail>(res);
}

/**
 * Send a user message and get back the AI reply.
 * Runs the full 7-step backend orchestration (save → history → Bedrock → save).
 */
export async function sendMessage(
  conversationId: number,
  content: string,
): Promise<SendMessageResponse> {
  const res = await fetch(`${CONV_URL}/${conversationId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ role: "user", content }),
  });
  return handleResponse<SendMessageResponse>(res);
}

/**
 * Rename a conversation.
 * PATCH /api/v1/conversations/{id}
 */
export async function renameConversation(
  id: number,
  title: string,
): Promise<Conversation> {
  const res = await fetch(`${CONV_URL}/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
  return handleResponse<Conversation>(res);
}
