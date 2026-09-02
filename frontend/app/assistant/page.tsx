"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { askKnowledgeBase, type KBSource } from "@/services/kbService";
import { useAuth } from "@/context/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  question: string;
  answer: string;
  sources: KBSource[];
  loading: boolean;
  error: string | null;
}

// ── Suggested questions ───────────────────────────────────────────────────────

const SUGGESTED = [
  "Do I need a visa to visit Japan?",
  "Can I bring medication into Japan?",
  "What is the best time to visit Bali?",
  "How much cash should I carry in Thailand?",
];

// ── Source chip ───────────────────────────────────────────────────────────────

function SourceChip({ source }: { source: KBSource }) {
  return (
    <a
      href={source.uri}
      target="_blank"
      rel="noopener noreferrer"
      title={source.uri}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d2044]/80 border border-blue-700/40 text-blue-300 text-xs font-mono hover:border-blue-500/60 hover:text-blue-200 transition"
    >
      <svg className="w-3 h-3 shrink-0 text-blue-400/70" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
        <rect x="2" y="1" width="9" height="13" rx="1" />
        <path d="M9 1v4h4" />
        <path d="M11 1l3 4" />
        <path d="M4 6h5M4 9h5M4 12h3" strokeWidth="0.9" />
      </svg>
      {source.title}
    </a>
  );
}

// ── Answer card ───────────────────────────────────────────────────────────────

function AnswerCard({ msg }: { msg: Message }) {
  if (msg.loading) {
    return (
      <div className="rounded-2xl border border-blue-800/40 bg-[#0a1c36]/70 p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-bold uppercase tracking-widest text-green-400">AI Answer</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-blue-300/60 text-sm">Searching knowledge base…</span>
        </div>
      </div>
    );
  }

  if (msg.error) {
    return (
      <div className="rounded-2xl border border-red-700/40 bg-red-950/30 p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-red-400">Error</span>
        </div>
        <p className="text-red-300 text-sm">{msg.error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-green-700/30 bg-[#0a1c36]/70 overflow-hidden">
      {/* Answer section */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-green-400">AI Answer</span>
        </div>
        <p className="text-blue-100 text-sm leading-relaxed whitespace-pre-wrap">{msg.answer}</p>
      </div>

      {/* Source section */}
      {msg.sources.length > 0 && (
        <div className="border-t border-blue-800/40 px-5 py-3.5 bg-[#071220]/60">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400/60 mb-2">Source</p>
          <div className="flex flex-wrap gap-2">
            {msg.sources.map((src, i) => (
              <SourceChip key={i} source={src} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Question bubble ───────────────────────────────────────────────────────────

function QuestionBubble({ question }: { question: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] bg-blue-600/80 border border-blue-500/40 rounded-2xl rounded-tr-sm px-4 py-2.5 text-white text-sm">
        {question}
      </div>
    </div>
  );
}

// ── Nav bar (matches app/page.tsx style) ──────────────────────────────────────

function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="sticky top-0 z-20 bg-[#071220]/90 backdrop-blur border-b border-blue-900/40 shadow-lg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-14">
        <Link
          href="/"
          className="text-blue-300 font-extrabold text-xl tracking-tight shrink-0 select-none hover:text-blue-200 transition"
        >
          ✈ KelanaAI
        </Link>

        <span className="text-blue-700/60 text-lg font-light select-none">/</span>

        <span className="text-blue-300 font-semibold text-sm select-none">
          Travel Assistant
        </span>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="text-blue-300/50 text-xs hidden sm:block">
                {user.name.split(" ")[0]}
              </span>
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="text-xs text-blue-400/60 hover:text-red-400 transition cursor-pointer"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-xs px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [nextId, setNextId]     = useState(1);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  // Scroll to the latest message whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit(question: string) {
    const q = question.trim();
    if (!q) return;

    setInput("");

    const id = nextId;
    setNextId((n) => n + 1);

    const placeholder: Message = {
      id,
      question: q,
      answer: "",
      sources: [],
      loading: true,
      error: null,
    };
    setMessages((prev) => [...prev, placeholder]);

    try {
      const data = await askKnowledgeBase(q);

      const { answer, sources } = data;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, loading: false, answer, sources }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                loading: false,
                error: err instanceof Error ? err.message : "Something went wrong",
              }
            : m
        )
      );
    }

    // Re-focus input after submit
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="min-h-screen bg-[#071220] text-white flex flex-col">
      <NavBar />

      {/* ── Conversation area ── */}
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pb-44">
        {/* Empty state — hero + suggested questions */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-2xl mb-5 select-none">
              🤖
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Ask KelanaAI</h1>
            <p className="text-blue-300/50 text-sm mb-8 max-w-sm">
              Powered by your trusted travel documents
            </p>

            {/* Suggested questions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => submit(q)}
                  className="text-left px-4 py-3 rounded-xl bg-[#0a1c36]/80 border border-blue-800/40 text-blue-200 text-sm hover:bg-blue-800/30 hover:border-blue-600/50 transition cursor-pointer leading-snug"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message thread */}
        {!isEmpty && (
          <div className="flex flex-col gap-5 pt-8">
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-3">
                <QuestionBubble question={msg.question} />
                <AnswerCard msg={msg} />
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Sticky input bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#071220]/95 backdrop-blur border-t border-blue-900/40 shadow-2xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 bg-[#0a1c36]/80 border border-blue-700/50 rounded-2xl px-4 py-2 focus-within:border-blue-500/70 focus-within:ring-1 focus-within:ring-blue-500/30 transition">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Can I bring medication into Japan?"
              className="flex-1 bg-transparent text-white placeholder-blue-400/40 text-sm focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => submit(input)}
              disabled={!input.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white text-sm font-semibold cursor-pointer shrink-0"
            >
              Ask
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          </div>
          <p className="text-center text-blue-400/30 text-xs mt-2.5 select-none">
            Answers are grounded in your uploaded documents.
          </p>
        </div>
      </div>
    </div>
  );
}


