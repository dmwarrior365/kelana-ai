"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

// ── Background (reused from home page style) ──────────────────────────────────

function TravelBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0a1628" />
          <stop offset="60%"  stopColor="#0d2347" />
          <stop offset="100%" stopColor="#1a3a6b" />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#sky)" />
      {[...Array(50)].map((_, i) => (
        <circle
          key={i}
          cx={(i * 137.5) % 1440}
          cy={(i * 97.3) % 400}
          r={i % 5 === 0 ? 1.5 : 0.8}
          fill="white"
          opacity={0.3 + (i % 3) * 0.15}
        />
      ))}
      <rect width="1440" height="900" fill="#071220" opacity="0.6" />
    </svg>
  );
}

// ── Tab type ──────────────────────────────────────────────────────────────────

type AuthTab = "login" | "register";

// ── Login / Register page ─────────────────────────────────────────────────────

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();

  const [tab, setTab]           = useState<AuthTab>("login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (tab === "register") {
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
    }

    setBusy(true);
    try {
      if (tab === "login") {
        await login({ email, password });
      } else {
        await register({ name, email, password });
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl bg-blue-950/60 border border-blue-700/50 text-white placeholder-blue-400/40 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition";

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#071220]">
      <TravelBackground />

      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-12">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-blue-300 font-extrabold text-2xl tracking-tight">
            ✈ KelanaAI
          </Link>
          <p className="text-blue-400/60 text-sm mt-1">Your AI-powered travel planner</p>
        </div>

        {/* Card */}
        <div className="bg-[#0a1c36]/90 backdrop-blur-md border border-blue-800/40 rounded-2xl shadow-2xl shadow-black/40 p-8">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-blue-950/60 border border-blue-800/40 p-1 mb-7">
            {(["login", "register"] as AuthTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  tab === t
                    ? "bg-blue-600 text-white shadow"
                    : "text-blue-300/60 hover:text-blue-200"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name — register only */}
            {tab === "register" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-blue-200 text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alice"
                  className={inputCls}
                />
              </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-blue-200 text-sm font-medium">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
                className={inputCls}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-blue-200 text-sm font-medium">Password</label>
              <input
                type="password"
                required
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "register" ? "Min. 8 characters" : "••••••••"}
                className={inputCls}
              />
            </div>

            {/* Confirm password — register only */}
            {tab === "register" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-blue-200 text-sm font-medium">Confirm Password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-950/50 border border-red-700/40 px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white font-semibold text-sm shadow-lg shadow-blue-900/40 cursor-pointer"
            >
              {busy
                ? (tab === "login" ? "Signing in…" : "Creating account…")
                : (tab === "login" ? "Sign In" : "Create Account")}
            </button>
          </form>
        </div>

        {/* Back link */}
        <p className="text-center text-blue-400/50 text-xs mt-6">
          <Link href="/" className="hover:text-blue-300 transition">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
