"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateTrip, getTrips } from "@/services/tripService";
import TripCard from "@/components/TripCard";
import { EmptyState } from "@/components/EmptyState";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import type { Trip, TravelStyle, SortField, SortOrder } from "@/types/trip";

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "home" | "trips";
type FormView = "form" | "loading" | "result" | "error";

// ── Markdown parser ───────────────────────────────────────────────────────────

interface TimeBlock {
  label: string;
  items: string[];
}

interface DayCard {
  title: string;
  blocks: TimeBlock[];
}

const TIME_LABELS = ["morning", "afternoon", "midday", "late afternoon", "evening", "night"];

function parseItinerary(markdown: string): DayCard[] {
  const lines = markdown.split("\n");
  const days: DayCard[] = [];
  let currentDay: DayCard | null = null;
  let currentBlock: TimeBlock | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/^#{2,3}\s+day\s+\d+/i.test(line)) {
      if (currentBlock && currentDay) currentDay.blocks.push(currentBlock);
      if (currentDay) days.push(currentDay);
      currentDay = { title: line.replace(/^#{2,3}\s+/, ""), blocks: [] };
      currentBlock = null;
      continue;
    }

    if (!currentDay) continue;

    const boldLabel = line.match(/^\*{1,2}([^*]+)\*{1,2}:?\s*$/);
    if (boldLabel) {
      const label = boldLabel[1].trim().toLowerCase();
      if (TIME_LABELS.some((t) => label.includes(t))) {
        if (currentBlock) currentDay.blocks.push(currentBlock);
        currentBlock = { label: boldLabel[1].trim(), items: [] };
        continue;
      }
    }

    const headingLabel = line.match(/^#{1,4}\s+(.+)$/);
    if (headingLabel) {
      const label = headingLabel[1].trim().toLowerCase();
      if (TIME_LABELS.some((t) => label.includes(t))) {
        if (currentBlock) currentDay.blocks.push(currentBlock);
        currentBlock = { label: headingLabel[1].trim(), items: [] };
        continue;
      }
      if (currentBlock) currentBlock.items.push(headingLabel[1].trim());
      continue;
    }

    if (/^[-*+]\s/.test(line) || /^\s+[-*+]\s/.test(line)) {
      const text = line
        .replace(/^\s*[-*+]\s+/, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .trim();
      if (text) {
        if (!currentBlock) currentBlock = { label: "Details", items: [] };
        currentBlock.items.push(text);
      }
      continue;
    }

    const text = line.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
    if (text && currentBlock) currentBlock.items.push(text);
  }

  if (currentBlock && currentDay) currentDay.blocks.push(currentBlock);
  if (currentDay) days.push(currentDay);
  return days;
}

// ── Time block colour map ─────────────────────────────────────────────────────

function blockStyle(label: string) {
  const l = label.toLowerCase();
  if (l.includes("morning"))                       return { icon: "🌅", border: "border-amber-500/30",  bg: "bg-amber-500/10",  text: "text-amber-300",  dot: "bg-amber-400" };
  if (l.includes("midday") || l.includes("lunch")) return { icon: "☀️", border: "border-yellow-400/30", bg: "bg-yellow-400/10", text: "text-yellow-300", dot: "bg-yellow-400" };
  if (l.includes("afternoon") || l.includes("late")) return { icon: "🌤", border: "border-orange-400/30", bg: "bg-orange-400/10", text: "text-orange-300", dot: "bg-orange-400" };
  if (l.includes("evening") || l.includes("night")) return { icon: "🌙", border: "border-indigo-400/30", bg: "bg-indigo-400/10", text: "text-indigo-300", dot: "bg-indigo-400" };
  return { icon: "📌", border: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-300", dot: "bg-blue-400" };
}

// ── DayCardView ───────────────────────────────────────────────────────────────

function DayCardView({ card, index }: { card: DayCard; index: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-blue-800/40 bg-[#0d2044]/60 shadow-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-blue-800/20 transition cursor-pointer"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 text-sm font-bold shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-white font-semibold text-sm">{card.title}</span>
        <span className="text-blue-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-3">
          {card.blocks.map((block, bi) => {
            const s = blockStyle(block.label);
            return (
              <div key={bi} className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{s.icon}</span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${s.text}`}>{block.label}</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {block.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2 text-sm text-blue-100/90">
                      <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── TravelBackground SVG ──────────────────────────────────────────────────────

function TravelBackground() {
  return (
    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0a1628" />
          <stop offset="60%"  stopColor="#0d2347" />
          <stop offset="100%" stopColor="#1a3a6b" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0d3b6e" />
          <stop offset="100%" stopColor="#061830" />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#sky)" />
      {[...Array(60)].map((_, i) => (
        <circle key={i} cx={(i * 137.5) % 1440} cy={(i * 97.3) % 400} r={i % 5 === 0 ? 1.5 : 0.8} fill="white" opacity={0.4 + (i % 3) * 0.2} />
      ))}
      <circle cx="1200" cy="120" r="50" fill="#1e4080" opacity="0.6" />
      <circle cx="1220" cy="105" r="44" fill="#0a1628" opacity="0.9" />
      <polygon points="0,600 200,300 400,600"       fill="#0d2347" opacity="0.9" />
      <polygon points="150,600 380,250 610,600"     fill="#0f2a56" opacity="0.95" />
      <polygon points="350,600 600,280 850,600"     fill="#0d2347" opacity="0.9" />
      <polygon points="600,600 880,220 1160,600"    fill="#0a1e3d" opacity="0.95" />
      <polygon points="900,600 1100,320 1300,600"   fill="#0d2347" opacity="0.9" />
      <polygon points="1100,600 1300,350 1440,600"  fill="#0f2a56" opacity="0.9" />
      <polygon points="200,300 230,340 170,340"     fill="white"   opacity="0.15" />
      <polygon points="380,250 415,300 345,300"     fill="white"   opacity="0.15" />
      <polygon points="600,280 640,330 560,330"     fill="white"   opacity="0.15" />
      <polygon points="880,220 925,275 835,275"     fill="white"   opacity="0.15" />
      <rect x="0" y="580" width="1440" height="320" fill="url(#sea)" opacity="0.7" />
      {[...Array(8)].map((_, i) => (
        <line key={i} x1="0" y1={610 + i * 30} x2="1440" y2={615 + i * 30} stroke="white" strokeWidth="0.5" opacity="0.06" />
      ))}
      <g transform="translate(300, 180) rotate(-15)" opacity="0.25">
        <ellipse cx="0" cy="0" rx="35" ry="7" fill="white" />
        <polygon points="-10,-7 10,-7 5,7 -5,7" fill="white" />
        <polygon points="-35,0 -20,-12 -15,0" fill="white" />
        <polygon points="35,0 20,-8 15,0" fill="white" />
        <polygon points="-5,7 5,7 2,14 -2,14" fill="white" />
      </g>
      <rect width="1440" height="900" fill="#071220" opacity="0.55" />
    </svg>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#071220]">
      <TravelBackground />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-blue-900/40" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-cyan-300 animate-spin [animation-duration:1.5s]" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">✈️</div>
        </div>
        <p className="text-white text-lg font-medium tracking-wide animate-pulse">Generating Your Itinerary</p>
        <p className="text-blue-300 text-sm opacity-75">Crafting your perfect travel plan…</p>
      </div>
    </div>
  );
}

// ── Nav bar ───────────────────────────────────────────────────────────────────

function NavBar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (t: Tab) => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="sticky top-0 z-20 bg-[#071220]/90 backdrop-blur border-b border-blue-900/40 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center gap-6 h-14">
        {/* Logo */}
        <span className="text-blue-300 font-extrabold text-xl tracking-tight shrink-0 select-none">
          ✈ KelanaAI
        </span>

        {/* Tabs */}
        <nav className="flex gap-1 ml-2">
          {(["home", "trips"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow"
                  : "text-blue-300/70 hover:text-blue-200 hover:bg-blue-800/30"
              }`}
            >
              {tab === "home" ? "🏠 Home" : "🗺️ My Trips"}
            </button>
          ))}
          <Link
            href="/chat"
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all text-blue-300/70 hover:text-blue-200 hover:bg-blue-800/30"
          >
            💬 Chat
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="text-blue-300/70 text-xs hidden sm:block">
                Welcome back, {user.name.split(" ")[0]} 👋
              </span>
              <Link
                href="/profile"
                className="text-xs text-blue-400/60 hover:text-blue-300 transition hidden sm:block"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
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

// ── Hero / story section ──────────────────────────────────────────────────────

function HeroSection({ onPlanTrip }: { onPlanTrip: () => void }) {
  return (
    <div className="relative min-h-[420px] flex items-center justify-center overflow-hidden">
      <TravelBackground />
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-800/40 border border-blue-600/30 rounded-full px-4 py-1.5 text-xs text-blue-300 font-medium mb-6">
          ✦ Powered by Amazon Bedrock
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight mb-4">
          Travel Smarter <br />
          <span className="text-blue-400">with AI</span>
        </h1>
        <p className="text-blue-200/70 text-lg mb-8 max-w-lg mx-auto leading-relaxed">
          KelanaAI crafts personalised day-by-day itineraries in seconds. Just tell us where
          you want to go, your budget, and travel style — we&apos;ll handle the rest.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={onPlanTrip}
            className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-base shadow-lg shadow-blue-900/50 cursor-pointer"
          >
            ✈ Plan a Trip
          </button>
          <Link
            href="/trips"
            className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 active:scale-95 transition-all text-white font-semibold text-base"
          >
            My Trips →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Feature highlights ────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "🤖", title: "AI-Generated Plans",   desc: "Amazon Bedrock builds a full day-by-day itinerary tailored to your budget and style." },
  { icon: "💰", title: "Budget Aware",          desc: "Automatic category detection — Backpacker, Standard or Luxury — with daily budget breakdown." },
  { icon: "🌏", title: "Any Destination",       desc: "From Bali beaches to Tokyo city lights. Just type a destination and we do the rest." },
  { icon: "📅", title: "Season-Smart",          desc: "Travel month input lets the AI factor in peak seasons, weather, and local events." },
];

function FeaturesSection() {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <h2 className="text-2xl font-bold text-white text-center mb-10">Why KelanaAI?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-[#0a1c36]/80 border border-blue-800/40 rounded-2xl p-6 flex gap-4">
            <span className="text-3xl shrink-0 select-none">{f.icon}</span>
            <div>
              <h3 className="text-white font-semibold mb-1">{f.title}</h3>
              <p className="text-blue-300/60 text-sm leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Trip generation form ──────────────────────────────────────────────────────

interface TripFormProps {
  onSuccess: (trip: Trip) => void;
  onError: (msg: string) => void;
  onLoading: () => void;
}

function TripForm({ onSuccess, onError, onLoading }: TripFormProps) {
  const [destination, setDestination] = useState("");
  const [days, setDays]               = useState("");
  const [budget, setBudget]           = useState("");
  const [travelStyle, setTravelStyle] = useState("");
  const [travelMonth, setTravelMonth] = useState("");
  const { user }                      = useAuth();
  const router                        = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }
    onLoading();
    try {
      const trip = await generateTrip({
        destination,
        days: parseInt(days),
        budget: parseFloat(budget),
        currency: "USD",
        travel_style: (travelStyle as Trip["travel_style"]) || null,
        travel_month: travelMonth || null,
      });
      onSuccess(trip);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const inputCls = "w-full rounded-lg bg-blue-950/60 border border-blue-700/50 text-white placeholder-blue-400/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition";
  const labelCls = "text-blue-200 text-sm font-medium";

  return (
    <section id="plan-form" className="max-w-lg mx-auto px-4 sm:px-6 pb-16">
      <div className="bg-[#0a1c36]/80 backdrop-blur-md border border-blue-800/40 rounded-2xl shadow-2xl p-8">
        <h2 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
          ✈ Plan Your Trip
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Destination</label>
            <input type="text" required value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Bali, Japan, Paris" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Number of Days</label>
              <input type="number" required min={1} value={days} onChange={(e) => setDays(e.target.value)} placeholder="e.g. 5" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Budget (USD)</label>
              <input type="number" required min={1} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 2000" className={inputCls} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>
              Travel Month <span className="text-blue-400/60 font-normal">(optional)</span>
            </label>
            <input type="text" value={travelMonth} onChange={(e) => setTravelMonth(e.target.value)} placeholder="e.g. June, December, 6" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Travel Style</label>
            <select value={travelStyle} onChange={(e) => setTravelStyle(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
              <option value=""          className="bg-[#0a1c36] text-blue-300">Select a style…</option>
              <option value="Backpacker" className="bg-[#0a1c36]">Backpacker</option>
              <option value="Family"    className="bg-[#0a1c36]">Family</option>
              <option value="Solo"      className="bg-[#0a1c36]">Solo</option>
              <option value="Couple"    className="bg-[#0a1c36]">Couple</option>
              <option value="Luxury"    className="bg-[#0a1c36]">Luxury</option>
              <option value="Adventure" className="bg-[#0a1c36]">Adventure</option>
            </select>
          </div>
          <button type="submit" className="mt-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-base shadow-lg shadow-blue-900/50 cursor-pointer">
            ✈ Generate Trip Report
          </button>
        </form>
      </div>
    </section>
  );
}

// ── Result view ───────────────────────────────────────────────────────────────

function ResultView({ trip, onReset }: { trip: Trip; onReset: () => void }) {
  const router = useRouter();

  function handleViewTrips() {
    router.push("/trips");
  }

  return (
    <div className="min-h-screen w-full bg-[#071220] text-white">
      <div className="sticky top-0 z-10 bg-[#0a1c36]/90 backdrop-blur border-b border-blue-900/40 shadow-lg">
        <div className="max-w-3xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-2xl font-bold text-blue-300 tracking-tight flex-1">✈ KelanaAI</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="bg-blue-800/60 border border-blue-600/40 px-3 py-1 rounded-full font-medium">📍 {trip.destination}</span>
            <span className="bg-blue-800/60 border border-blue-600/40 px-3 py-1 rounded-full font-medium">🗓 {trip.days} day{trip.days > 1 ? "s" : ""}</span>
            <span className="bg-blue-800/60 border border-blue-600/40 px-3 py-1 rounded-full font-medium">💰 {trip.currency} {trip.budget.toLocaleString()}</span>
            {trip.travel_style && <span className="bg-cyan-800/60 border border-cyan-600/40 px-3 py-1 rounded-full font-medium">🎒 {trip.travel_style}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex flex-wrap gap-2 mb-6 text-xs">
          <span className="bg-blue-900/50 border border-blue-700/40 text-blue-200 px-3 py-1 rounded-full">{trip.category}</span>
          {trip.recommendation_transport && <span className="bg-blue-900/50 border border-blue-700/40 text-blue-200 px-3 py-1 rounded-full">{trip.recommendation_transport}</span>}
          {trip.travel_season && <span className="bg-blue-900/50 border border-blue-700/40 text-blue-200 px-3 py-1 rounded-full">{trip.travel_season}</span>}
          <span className="bg-blue-900/50 border border-blue-700/40 text-blue-200 px-3 py-1 rounded-full">~{trip.currency} {trip.daily_budget?.toFixed(0)}/day</span>
        </div>

        {trip.ai_recommendation ? (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">✦ AI Itinerary</p>
            {parseItinerary(trip.ai_recommendation).length > 0
              ? parseItinerary(trip.ai_recommendation).map((card, i) => <DayCardView key={i} card={card} index={i} />)
              : <div className="bg-[#0d2044]/70 border border-blue-800/40 rounded-2xl p-6 text-blue-100 text-sm whitespace-pre-wrap leading-relaxed">{trip.ai_recommendation}</div>
            }
          </div>
        ) : (
          <div className="bg-[#0d2044]/70 border border-blue-800/40 rounded-2xl p-6">
            <p className="text-blue-300 italic text-sm">No itinerary generated yet.</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={handleViewTrips} className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold shadow-lg shadow-blue-900/40 cursor-pointer">
            🗺️ View My Trips
          </button>
          <button onClick={onReset} className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 active:scale-95 transition-all text-white font-semibold cursor-pointer">
            ✈ Plan Another Trip
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Error view ────────────────────────────────────────────────────────────────

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const isNetwork = /fetch|network|failed to fetch/i.test(message);
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <TravelBackground />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 text-center flex flex-col items-center gap-6">
        <div className="text-6xl">{isNetwork ? "📡" : "⚠️"}</div>
        <div>
          <h2 className="text-2xl font-bold text-red-300 mb-1">{isNetwork ? "Cannot reach the server" : "Something went wrong"}</h2>
          <p className="text-blue-200/60 text-sm">{isNetwork ? "Make sure the backend is running on localhost:8000" : "An error occurred while planning your trip"}</p>
        </div>
        <div className="w-full bg-red-950/40 border border-red-700/40 rounded-xl px-5 py-4 text-red-300 text-sm text-left break-words">{message}</div>
        <button onClick={onRetry} className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-sm shadow-lg cursor-pointer">
          ← Try Again
        </button>
      </div>
    </div>
  );
}

// ── Home tab content ──────────────────────────────────────────────────────────

function HomeTabContent() {
  const [formView, setFormView] = useState<FormView>("form");
  const [trip, setTrip]         = useState<Trip | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { user }                = useAuth();
  const router                  = useRouter();

  function handlePlanTrip() {
    if (!user) {
      router.push("/login");
      return;
    }
    setShowForm(true);
  }

  if (formView === "loading") return <LoadingScreen />;
  if (formView === "result" && trip) return <ResultView trip={trip} onReset={() => { setTrip(null); setFormView("form"); setShowForm(false); }} />;
  if (formView === "error")  return <ErrorView message={errorMsg ?? "Unknown error"} onRetry={() => setFormView("form")} />;

  return (
    <div className="bg-[#071220] min-h-screen">
      <HeroSection onPlanTrip={handlePlanTrip} />

      {showForm && (
        <TripForm
          onLoading={() => setFormView("loading")}
          onSuccess={(t) => { setTrip(t); setFormView("result"); }}
          onError={(msg) => { setErrorMsg(msg); setFormView("error"); }}
        />
      )}

      <FeaturesSection />

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="text-2xl font-bold text-white text-center mb-10">How It Works</h2>
        <div className="flex flex-col sm:flex-row gap-6">
          {[
            { step: "1", icon: "📝", title: "Fill the Form",     desc: "Enter your destination, days, budget, and travel preferences." },
            { step: "2", icon: "🤖", title: "AI Builds the Plan", desc: "Our AI analyses your inputs and generates a custom itinerary." },
            { step: "3", icon: "🗺️", title: "Explore & Save",    desc: "View your day-by-day plan and save it to My Trips for future reference." },
          ].map((item) => (
            <div key={item.step} className="flex-1 bg-[#0a1c36]/60 border border-blue-800/40 rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3 select-none">{item.icon}</div>
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold mb-3">{item.step}</div>
              <h3 className="text-white font-semibold mb-1">{item.title}</h3>
              <p className="text-blue-300/60 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Sort helper ───────────────────────────────────────────────────────────────

const TRAVEL_STYLES: TravelStyle[] = ["Backpacker", "Family", "Solo", "Couple", "Luxury", "Adventure"];
const PAGE_SIZE = 10;

function sortTrips(trips: Trip[], field: SortField, order: SortOrder): Trip[] {
  return [...trips].sort((a, b) => {
    let cmp = 0;
    if (field === "budget") {
      cmp = a.budget - b.budget;
    } else {
      const ta = a.created_at ? new Date(a.created_at).getTime() : a.id;
      const tb = b.created_at ? new Date(b.created_at).getTime() : b.id;
      cmp = ta - tb;
    }
    return order === "asc" ? cmp : -cmp;
  });
}

// ── Sort dropdown ─────────────────────────────────────────────────────────────

type SortOption = { label: string; field: SortField; order: SortOrder };

const SORT_OPTIONS: SortOption[] = [
  { label: "Latest first",       field: "created_at", order: "desc" },
  { label: "Oldest first",       field: "created_at", order: "asc"  },
  { label: "Highest budget",     field: "budget",     order: "desc" },
  { label: "Lowest budget",      field: "budget",     order: "asc"  },
];

function SortDropdown({
  sortField, sortOrder,
  onSortField, onSortOrder,
}: {
  sortField: SortField; sortOrder: SortOrder;
  onSortField: (v: SortField) => void; onSortOrder: (v: SortOrder) => void;
}) {
  const [open, setOpen] = useState(false);

  const active = SORT_OPTIONS.find(
    (o) => o.field === sortField && o.order === sortOrder
  ) ?? SORT_OPTIONS[0];

  function pick(opt: SortOption) {
    onSortField(opt.field);
    onSortOrder(opt.order);
    setOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-sort-dropdown]")) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" data-sort-dropdown="">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-950/60 border border-blue-700/50 text-blue-200 text-sm font-medium hover:bg-blue-800/40 hover:border-blue-500/60 transition-all cursor-pointer select-none"
      >
        <span className="text-blue-400/70 text-xs">Sort by</span>
        <span className="text-white font-semibold">{active.label}</span>
        <svg
          className={`w-3.5 h-3.5 text-blue-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 8" fill="none"
        >
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-2xl bg-[#0d1e3d] border border-blue-700/50 shadow-2xl shadow-black/40 overflow-hidden">
          {SORT_OPTIONS.map((opt, i) => {
            const isActive = opt.field === sortField && opt.order === sortOrder;
            return (
              <button
                key={opt.label}
                onClick={() => pick(opt)}
                className={`
                  w-full text-left px-5 py-3.5 text-sm font-medium transition-colors cursor-pointer
                  ${i !== SORT_OPTIONS.length - 1 ? "border-b border-blue-800/40" : ""}
                  ${isActive
                    ? "bg-blue-500/20 text-blue-300"
                    : "text-blue-100/80 hover:bg-blue-800/30 hover:text-white"
                  }
                `}
              >
                <span className="flex items-center justify-between">
                  {opt.label}
                  {isActive && (
                    <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.3 4.3a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L6.6 9.6l5.3-5.3a1 1 0 0 1 1.4 0z" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Inline filter bar ─────────────────────────────────────────────────────────

interface FilterBarProps {
  search: string; onSearch: (v: string) => void;
  styleFilter: TravelStyle | ""; onStyleFilter: (v: TravelStyle | "") => void;
  sortField: SortField; onSortField: (v: SortField) => void;
  sortOrder: SortOrder; onSortOrder: (v: SortOrder) => void;
  total: number; filtered: number;
}

function FilterBar({ search, onSearch, styleFilter, onStyleFilter, sortField, onSortField, sortOrder, onSortOrder, total, filtered }: FilterBarProps) {
  const sel = "rounded-xl bg-blue-950/60 border border-blue-700/50 text-white text-sm px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition appearance-none cursor-pointer";
  return (
    <div className="bg-[#0a1c36]/70 border border-blue-800/40 rounded-2xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Search */}
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/60 text-sm pointer-events-none">🔍</span>
          <input
            type="text" value={search} onChange={(e) => onSearch(e.target.value)}
            placeholder="Search destination…"
            className="w-full rounded-xl bg-blue-950/60 border border-blue-700/50 text-white placeholder-blue-400/50 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition"
          />
        </div>

        {/* Travel style filter */}
        <select value={styleFilter} onChange={(e) => onStyleFilter(e.target.value as TravelStyle | "")} className={sel}>
          <option value="" className="bg-[#0a1c36]">All Styles</option>
          {TRAVEL_STYLES.map((s) => <option key={s} value={s} className="bg-[#0a1c36]">{s}</option>)}
        </select>

        {/* Custom sort dropdown */}
        <SortDropdown
          sortField={sortField} sortOrder={sortOrder}
          onSortField={onSortField} onSortOrder={onSortOrder}
        />
      </div>

      {/* Result count */}
      <p className="mt-3 text-xs text-blue-400/60">
        {filtered === total
          ? `${total} saved itinerar${total === 1 ? "y" : "ies"}`
          : `${filtered} of ${total} trips`}
      </p>
    </div>
  );
}

// ── Inline pagination ─────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btn = "flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer";
  return (
    <div className="flex items-center justify-center gap-1.5 mt-8">
      <button onClick={() => onPage(page - 1)} disabled={page === 1} className={`${btn} ${page === 1 ? "opacity-30 cursor-not-allowed" : "text-blue-300/70 hover:bg-blue-800/40 hover:text-white"}`}>‹</button>
      {pages.map((p, i) => p === "…"
        ? <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-blue-400/50 text-sm">…</span>
        : <button key={p} onClick={() => onPage(p as number)} className={`${btn} ${page === p ? "bg-blue-600 text-white shadow" : "text-blue-300/70 hover:bg-blue-800/40 hover:text-white"}`}>{p}</button>
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className={`${btn} ${page === totalPages ? "opacity-30 cursor-not-allowed" : "text-blue-300/70 hover:bg-blue-800/40 hover:text-white"}`}>›</button>
    </div>
  );
}

// ── My Trips tab ──────────────────────────────────────────────────────────────

function MyTripsTab({ onPlanTrip }: { onPlanTrip: () => void }) {
  const [trips, setTrips]             = useState<Trip[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [styleFilter, setStyleFilter] = useState<TravelStyle | "">("");
  const [sortField, setSortField]     = useState<SortField>("created_at");
  const [sortOrder, setSortOrder]     = useState<SortOrder>("desc");
  const [page, setPage]               = useState(1);

  async function fetchTrips() {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrips();
      setTrips(data.sort((a, b) => b.id - a.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setLoading(false);
    }
  }

  // Fetch whenever this tab mounts
  useEffect(() => { fetchTrips(); }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, styleFilter, sortField, sortOrder]);

  const filtered = useMemo(() => {
    let result = trips;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) => t.destination.toLowerCase().includes(q));
    }
    if (styleFilter) result = result.filter((t) => t.travel_style === styleFilter);
    return sortTrips(result, sortField, sortOrder);
  }, [trips, search, styleFilter, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Trip History</h1>
          {!loading && !error && (
            <p className="text-blue-300/60 text-sm mt-1">
              {trips.length} saved itinerar{trips.length === 1 ? "y" : "ies"}
            </p>
          )}
        </div>
        <button onClick={fetchTrips} title="Refresh"
          className="p-2 rounded-full text-blue-400/60 hover:text-blue-200 hover:bg-blue-800/30 transition cursor-pointer text-lg">
          🔄
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-blue-900/20 border border-blue-800/30 animate-pulse" />)}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-950/40 border border-red-700/40 rounded-2xl p-6 text-center">
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <button onClick={fetchTrips} className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold cursor-pointer transition">
            Retry
          </button>
        </div>
      )}

      {/* Empty — no trips at all */}
      {!loading && !error && trips.length === 0 && (
        <EmptyState
          icon="🗺️"
          title="No trips yet"
          description="You haven't planned any trips yet. Start by generating your first AI itinerary!"
          action={{ label: "✈ Plan your first trip", onClick: onPlanTrip }}
        />
      )}

      {/* Trip list */}
      {!loading && !error && trips.length > 0 && (
        <>
          <FilterBar
            search={search}           onSearch={setSearch}
            styleFilter={styleFilter} onStyleFilter={setStyleFilter}
            sortField={sortField}     onSortField={setSortField}
            sortOrder={sortOrder}     onSortOrder={setSortOrder}
            total={trips.length}      filtered={filtered.length}
          />
          {filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No trips match your filters"
              description="Try adjusting your search or clearing the travel style filter."
              action={{ label: "Clear filters", onClick: () => { setSearch(""); setStyleFilter(""); } }}
            />
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {paginated.map((trip) => <TripCard key={trip.id} trip={trip} />)}
              </div>
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const { user } = useAuth();
  const router = useRouter();

  function handleTabChange(tab: Tab) {
    if (tab === "trips" && !user) {
      router.push("/login");
      return;
    }
    setActiveTab(tab);
  }

  return (
    <div className="min-h-screen bg-[#071220] text-white">
      <NavBar activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === "home" && <HomeTabContent />}

      {activeTab === "trips" && (
        <AuthGuard>
          <MyTripsTab onPlanTrip={() => setActiveTab("home")} />
        </AuthGuard>
      )}
    </div>
  );
}
