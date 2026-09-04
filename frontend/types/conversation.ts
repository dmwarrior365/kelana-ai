// ─── API shapes (mirror backend _conversation_response / _message_response) ──

export interface Conversation {
  id:         number;
  user_id:    number;
  title:      string | null;
  created_at: string;   // ISO 8601
  updated_at: string;   // ISO 8601
}

export interface ApiMessage {
  id:              number;
  conversation_id: number;
  role:            "user" | "assistant";
  content:         string;
  created_at:      string;   // ISO 8601
}

export interface ConversationDetail extends Conversation {
  messages: ApiMessage[];
}

export interface SendMessageResponse {
  user_message:      ApiMessage;
  assistant_message: ApiMessage;
}

// ─── Client-side chat message (used in the UI state) ─────────────────────────

export interface ChatMessage {
  /** Temporary negative id while the AI response is in-flight; real DB id after. */
  id:         number;
  role:       "user" | "assistant";
  content:    string;
  /** ISO 8601 — undefined for optimistic (in-flight) messages. */
  created_at?: string;
  /** True while waiting for the assistant reply. */
  loading?:   boolean;
  /** Non-null when the request failed. */
  error?:     string | null;
}
