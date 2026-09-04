"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import {
  listConversations,
  createConversation,
  getConversation,
  sendMessage,
  renameConversation,
} from "@/services/conversationService";
import type { Conversation, ChatMessage } from "@/types/conversation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Format an ISO timestamp as "HH:MM" (local time), e.g. "14:32". */
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format an ISO timestamp as "Today HH:MM", "Yesterday HH:MM", or "MMM D HH:MM". */
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  const time = formatTimestamp(iso);
  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KelanaLogo() {
  return (
    <svg
      className="w-4 h-4 text-blue-400 shrink-0"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M8 1.5a.75.75 0 01.75.75v3.94l2.47-2.47a.75.75 0 111.06 1.06L9.81 7.25H13a.75.75 0 010 1.5H9.81l2.47 2.47a.75.75 0 11-1.06 1.06L8.75 9.81V13a.75.75 0 01-1.5 0V9.81l-2.47 2.47a.75.75 0 11-1.06-1.06L6.19 8.75H3a.75.75 0 010-1.5h3.19L3.72 4.78a.75.75 0 011.06-1.06L7.25 6.19V2.25A.75.75 0 018 1.5z" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-blue-400/60 text-xs">Kelana is typing…</span>
    </div>
  );
}

interface MessageBubbleProps {
  msg: ChatMessage;
}

function MessageBubble({ msg }: MessageBubbleProps) {
  if (msg.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
          {msg.content}
        </div>
        {msg.created_at && (
          <span className="text-[10px] text-blue-400/35 pr-1 select-none">
            {formatMessageTime(msg.created_at)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-7 h-7 rounded-xl bg-blue-900/60 border border-blue-700/40 flex items-center justify-center shrink-0 mt-0.5">
        <KelanaLogo />
      </div>

      <div className="flex flex-col gap-1 max-w-[85%]">
        <div className="rounded-2xl rounded-tl-sm bg-[#0a1c36]/80 border border-blue-800/30 px-4 py-3 text-sm text-blue-100 leading-relaxed shadow-sm">
          {msg.loading ? (
            <TypingDots />
          ) : msg.error ? (
            <span className="text-red-400">{msg.error}</span>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h2]:text-blue-200 [&_h3]:text-blue-300 [&_strong]:text-blue-200 [&_table]:text-xs [&_th]:text-blue-300 [&_td]:text-blue-100">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!msg.loading && msg.created_at && (
          <span className="text-[10px] text-blue-400/35 pl-1 select-none">
            {formatMessageTime(msg.created_at)}
          </span>
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onRename: (id: number, currentTitle: string) => void;
}

function ConversationItem({
  conv,
  active,
  onSelect,
  onRename,
}: ConversationItemProps) {
  const title = conv.title ?? "New conversation";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`group w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-2 cursor-pointer ${
        active
          ? "bg-blue-600/25 border border-blue-500/30"
          : "hover:bg-[#0a1c36]/60 border border-transparent"
      }`}
    >
      <svg
        className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500/60"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H9.5l-1.5 2-1.5-2H3a1 1 0 01-1-1V3z" />
      </svg>

      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-medium truncate leading-snug ${
            active ? "text-white" : "text-blue-200/80"
          }`}
        >
          {title}
        </p>
        <p className="text-[10px] text-blue-400/40 mt-0.5">
          {formatDate(conv.created_at)}
        </p>
      </div>

      {/* Rename button — only visible on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRename(conv.id, conv.title ?? "");
        }}
        title="Rename"
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-blue-700/40 text-blue-400/60 hover:text-blue-300 shrink-0 cursor-pointer"
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" />
        </svg>
      </button>
    </div>
  );
}

// ─── Rename modal ─────────────────────────────────────────────────────────────

interface RenameModalProps {
  initialTitle: string;
  onConfirm: (title: string) => void;
  onCancel: () => void;
}

function RenameModal({ initialTitle, onConfirm, onCancel }: RenameModalProps) {
  const [value, setValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) onConfirm(value.trim());
    }
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1f3a] border border-blue-800/50 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5">
        <h3 className="text-white font-semibold text-sm mb-3">
          Rename conversation
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={120}
          placeholder="Conversation name"
          className="w-full bg-[#071220] border border-blue-700/50 rounded-xl px-3 py-2 text-sm text-white placeholder-blue-400/40 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition"
        />
        <div className="flex gap-2 mt-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg text-xs text-blue-400/70 hover:text-blue-300 hover:bg-blue-800/30 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => value.trim() && onConfirm(value.trim())}
            disabled={!value.trim()}
            className="px-4 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition cursor-pointer"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

let _tempId = -1;
function tempId() {
  return _tempId--;
}

function ChatPageInner() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // ── Sidebar state ──────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Active conversation ────────────────────────────────────────────────────
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // ── Input ──────────────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // ── Rename modal ───────────────────────────────────────────────────────────
  const [renameTarget, setRenameTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // ── Load sidebar ───────────────────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    try {
      const list = await listConversations();
      setConversations(list);
    } catch {
      // silently ignore — not critical
    } finally {
      setSidebarLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  // Track whether the last scroll should be instant (conversation just opened)
  // vs. smooth (new message appended while chatting).
  const scrollBehaviorRef = useRef<ScrollBehavior>("instant");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: scrollBehaviorRef.current });
    // Reset to smooth after the initial instant jump
    scrollBehaviorRef.current = "smooth";
  }, [messages]);

  // ── Load a conversation ────────────────────────────────────────────────────
  async function loadConversation(id: number) {
    setActiveConvId(id);
    setMessages([]);
    setMessagesLoading(true);
    // Next scroll triggered by setMessages will jump instantly to the bottom
    scrollBehaviorRef.current = "instant";
    try {
      const detail = await getConversation(id);
      const loaded: ChatMessage[] = detail.messages.map((m) => ({
        id:         m.id,
        role:       m.role,
        content:    m.content,
        created_at: m.created_at,
      }));
      setMessages(loaded);
    } catch (err) {
      setMessages([
        {
          id: tempId(),
          role: "assistant",
          content: "",
          error:
            err instanceof Error ? err.message : "Failed to load messages.",
        },
      ]);
    } finally {
      setMessagesLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // ── New conversation ───────────────────────────────────────────────────────
  async function startNewConversation() {
    try {
      const { conversation_id } = await createConversation();
      await refreshConversations();
      await loadConversation(conversation_id);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function submit() {
    const text = input.trim();
    if (!text || sending) return;

    // If no active conversation, create one first
    let convId = activeConvId;
    if (convId === null) {
      try {
        const res = await createConversation({ firstMessage: text });
        convId = res.conversation_id;
        setActiveConvId(convId);
        await refreshConversations();
      } catch (err) {
        console.error("Failed to create conversation:", err);
        return;
      }
    }

    setInput("");
    setSending(true);

    // Optimistically add user bubble + loading assistant bubble
    const userTempId = tempId();
    const asstTempId = tempId();
    setMessages((prev) => [
      ...prev,
      { id: userTempId, role: "user", content: text },
      { id: asstTempId, role: "assistant", content: "", loading: true },
    ]);

    try {
      const result = await sendMessage(convId, text);

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === userTempId) {
            return { ...m, id: result.user_message.id, created_at: result.user_message.created_at };
          }
          if (m.id === asstTempId) {
            return {
              id:         result.assistant_message.id,
              role:       "assistant" as const,
              content:    result.assistant_message.content,
              created_at: result.assistant_message.created_at,
              loading:    false,
            };
          }
          return m;
        })
      );

      // Refresh sidebar to update titles auto-derived from first message
      await refreshConversations();
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstTempId
            ? {
                ...m,
                loading: false,
                error:
                  err instanceof Error ? err.message : "Something went wrong.",
              }
            : m
        )
      );
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  // ── Rename ─────────────────────────────────────────────────────────────────
  function openRename(id: number, currentTitle: string) {
    setRenameTarget({ id, title: currentTitle });
  }

  async function confirmRename(newTitle: string) {
    if (!renameTarget) return;
    try {
      const updated = await renameConversation(renameTarget.id, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
    } catch (err) {
      console.error("Rename failed:", err);
    } finally {
      setRenameTarget(null);
    }
  }

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  const isEmpty = messages.length === 0 && !messagesLoading;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#071220] text-white overflow-hidden">
      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`flex flex-col shrink-0 transition-all duration-200 border-r border-blue-900/40 bg-[#060f1c] ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-blue-900/40">
          <Link
            href="/"
            className="text-blue-300 font-extrabold text-base tracking-tight hover:text-blue-200 transition select-none"
          >
            ✈ KelanaAI
          </Link>
          <button
            onClick={startNewConversation}
            title="New conversation"
            className="p-1.5 rounded-lg hover:bg-blue-800/40 text-blue-400/70 hover:text-blue-300 transition cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {sidebarLoading ? (
            <div className="flex justify-center pt-8">
              <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-blue-400/30 text-xs pt-10 px-4 leading-relaxed">
              No conversations yet.
              <br />
              Start a new chat.
            </p>
          ) : (
            conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeConvId}
                onSelect={() => loadConversation(conv.id)}
                onRename={openRename}
              />
            ))
          )}
        </div>

        {/* User footer */}
        <div className="border-t border-blue-900/40 px-3 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-700/40 border border-blue-600/40 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0 select-none">
            {user?.name.charAt(0).toUpperCase() ?? "?"}
          </div>
          <span className="flex-1 min-w-0 text-xs text-blue-300/60 truncate">
            {user?.name ?? ""}
          </span>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            title="Sign out"
            className="text-blue-400/40 hover:text-red-400 transition cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 8h7M11 5l3 3-3 3" />
              <path d="M9 3H3v10h6" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main chat panel ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 h-12 border-b border-blue-900/40 bg-[#071220]/95 backdrop-blur shrink-0">
          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            className="p-1.5 rounded-lg hover:bg-blue-800/40 text-blue-400/60 hover:text-blue-300 transition cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-blue-200 leading-tight">
                {activeConvId
                  ? (conversations.find((c) => c.id === activeConvId)?.title ??
                    "New conversation")
                  : "KelanaAI Chat"}
              </span>
              {activeConvId && messages.length > 0 && (
                <span className="text-[10px] text-blue-400/40 leading-tight">
                  {messages.filter((m) => !m.loading).length} messages
                </span>
              )}
            </div>
          </div>

          {/* Rename active conversation */}
          {activeConvId !== null && (
            <button
              onClick={() => {
                const conv = conversations.find((c) => c.id === activeConvId);
                if (conv) openRename(conv.id, conv.title ?? "");
              }}
              title="Rename this conversation"
              className="ml-1 p-1 rounded-lg hover:bg-blue-800/40 text-blue-400/40 hover:text-blue-300 transition cursor-pointer"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" />
              </svg>
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/trips"
              className="text-xs text-blue-400/50 hover:text-blue-300 transition"
            >
              Trips
            </Link>
            <span className="text-blue-800/60">·</span>
            <Link
              href="/assistant"
              className="text-xs text-blue-400/50 hover:text-blue-300 transition"
            >
              KB Assistant
            </Link>
          </div>
        </header>

        {/* Message thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-3xl mx-auto">
            {/* Empty state */}
            {isEmpty && (
              <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-700/30 flex items-center justify-center mb-5">
                  <svg
                    className="w-7 h-7 text-blue-400/70"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2a.75.75 0 01.75.75v5.69l3.22-3.22a.75.75 0 111.06 1.06l-3.22 3.22H19a.75.75 0 010 1.5h-5.19l3.22 3.22a.75.75 0 11-1.06 1.06L12.75 12.81V18a.75.75 0 01-1.5 0v-5.19l-3.22 3.22a.75.75 0 11-1.06-1.06l3.22-3.22H5a.75.75 0 010-1.5h5.19L6.97 7.03a.75.75 0 111.06-1.06l3.22 3.22V2.75A.75.75 0 0112 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white mb-1.5">
                  Start a conversation
                </h2>
                <p className="text-blue-300/40 text-sm max-w-xs leading-relaxed">
                  Ask Kelana anything about travel — itineraries, budgets, visas,
                  local tips, and more.
                </p>

                {/* Suggested prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-8 w-full max-w-lg">
                  {[
                    "Plan a 7-day Japan itinerary for a family of 4",
                    "What's the budget for a trip to Bali on USD 1,500?",
                    "Best time to visit South Korea?",
                    "Do I need a visa for Thailand as a US citizen?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setInput(prompt);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="text-left text-xs px-3.5 py-3 rounded-xl bg-[#0a1c36]/70 border border-blue-800/30 text-blue-200/70 hover:bg-blue-800/25 hover:border-blue-600/40 hover:text-blue-200 transition leading-snug cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messagesLoading && (
              <div className="flex justify-center pt-12">
                <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              </div>
            )}

            {!messagesLoading && messages.length > 0 && (
              <div className="flex flex-col gap-4">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-blue-900/40 bg-[#071220]/95 backdrop-blur px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2.5 bg-[#0a1c36]/80 border border-blue-700/40 rounded-2xl px-4 py-2.5 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/20 transition">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                disabled={sending}
                className="flex-1 bg-transparent text-white placeholder-blue-400/35 text-sm focus:outline-none resize-none leading-relaxed disabled:opacity-50 min-h-[24px]"
                style={{ maxHeight: "160px" }}
              />
              <button
                onClick={submit}
                disabled={!input.trim() || sending}
                title="Send"
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer"
              >
                {sending ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <svg
                    className="w-3.5 h-3.5 text-white"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-center text-blue-400/25 text-[10px] mt-2 select-none">
              Shift+Enter for new line · Enter to send · Context window: last 20
              turns
            </p>
          </div>
        </div>
      </div>

      {/* ── Rename modal ──────────────────────────────────────────────────── */}
      {renameTarget !== null && (
        <RenameModal
          initialTitle={renameTarget.title}
          onConfirm={confirmRename}
          onCancel={() => setRenameTarget(null)}
        />
      )}
    </div>
  );
}

// ── Wrap in AuthGuard so unauthenticated users are redirected to /login ────────

export default function ChatPage() {
  return (
    <AuthGuard>
      <ChatPageInner />
    </AuthGuard>
  );
}
