"use client";

import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface TripResult {
  id: number;
  destination: string;
  days: number;
  budget: number;
  currency: string;
  daily_budget: number;
  travel_style: string | null;
  travel_month: string | null;
  travel_season: string | null;
  category: string;
  recommendation_transport: string;
  ai_recommendation: string | null;
}

type View = "form" | "loading" | "result" | "error";

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

    // ### Day X: ... or ## Day X: ...
    if (/^#{2,3}\s+day\s+\d+/i.test(line)) {
      if (currentBlock && currentDay) currentDay.blocks.push(currentBlock);
      if (currentDay) days.push(currentDay);
      currentDay = { title: line.replace(/^#{2,3}\s+/, ""), blocks: [] };
      currentBlock = null;
      continue;
    }

    if (!currentDay) continue;

    // **Morning:** / **Afternoon:** etc (bold label line)
    const boldLabel = line.match(/^\*{1,2}([^*]+)\*{1,2}:?\s*$/);
    if (boldLabel) {
      const label = boldLabel[1].trim().toLowerCase();
      if (TIME_LABELS.some((t) => label.includes(t))) {
        if (currentBlock) currentDay.blocks.push(currentBlock);
        currentBlock = { label: boldLabel[1].trim(), items: [] };
        continue;
      }
    }

    // Heading-style time label: ### Morning
    const headingLabel = line.match(/^#{1,4}\s+(.+)$/);
    if (headingLabel) {
      const label = headingLabel[1].trim().toLowerCase();
      if (TIME_LABELS.some((t) => label.includes(t))) {
        if (currentBlock) currentDay.blocks.push(currentBlock);
        currentBlock = { label: headingLabel[1].trim(), items: [] };
        continue;
      }
      // Non-time heading inside a day — treat as intro text
      if (currentBlock) currentBlock.items.push(headingLabel[1].trim());
      continue;
    }

    // Bullet points — strip markdown list markers and bold
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

    // Plain text line
    const text = line.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
    if (text && currentBlock) currentBlock.items.push(text);
  }

  if (currentBlock && currentDay) currentDay.blocks.push(currentBlock);
  if (currentDay) days.push(currentDay);

  return days;
}

// ── Time block colour map ─────────────────────────────────────────────────────

function blockStyle(label: string): { icon: string; border: string; bg: string; text: string; badge: string } {
  const l = label.toLowerCase();
  if (l.includes("morning"))       return { icon: "🌅", border: "border-amber-500/30",  bg: "bg-amber-500/10",  text: "text-amber-300",  badge: "bg-amber-500/20 text-amber-200" };
  if (l.includes("midday") || l.includes("lunch")) return { icon: "☀️", border: "border-yellow-400/30", bg: "bg-yellow-400/10", text: "text-yellow-300", badge: "bg-yellow-400/20 text-yellow-200" };
  if (l.includes("afternoon") || l.includes("late")) return { icon: "🌤", border: "border-orange-400/30", bg: "bg-orange-400/10", text: "text-orange-300", badge: "bg-orange-400/20 text-orange-200" };
  if (l.includes("evening") || l.includes("night")) return { icon: "🌙", border: "border-indigo-400/30", bg: "bg-indigo-400/10", text: "text-indigo-300", badge: "bg-indigo-400/20 text-indigo-200" };
  return { icon: "📌", border: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-300", badge: "bg-blue-500/20 text-blue-200" };
}

// ── Day card component ────────────────────────────────────────────────────────

function DayCardView({ card, index }: { card: DayCard; index: number }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-blue-800/40 bg-[#0d2044]/60 shadow-lg overflow-hidden">
      {/* Card header */}
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

      {/* Blocks */}
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-3">
          {card.blocks.map((block, bi) => {
            const style = blockStyle(block.label);
            return (
              <div key={bi} className={`rounded-xl border ${style.border} ${style.bg} p-4`}>
                {/* Block header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{style.icon}</span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>
                    {block.label}
                  </span>
                </div>
                {/* Items */}
                <ul className="flex flex-col gap-1.5">
                  {block.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2 text-sm text-blue-100/90">
                      <span className={`mt-1 shrink-0 w-1.5 h-1.5 rounded-full ${style.badge.split(" ")[0]}`} />
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

// ── Travel background SVG ─────────────────────────────────────────────────────

function TravelBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Sky gradient */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1628" />
          <stop offset="60%" stopColor="#0d2347" />
          <stop offset="100%" stopColor="#1a3a6b" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d3b6e" />
          <stop offset="100%" stopColor="#061830" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="1440" height="900" fill="url(#sky)" />

      {/* Stars */}
      {[...Array(60)].map((_, i) => (
        <circle
          key={i}
          cx={(i * 137.5) % 1440}
          cy={(i * 97.3) % 400}
          r={i % 5 === 0 ? 1.5 : 0.8}
          fill="white"
          opacity={0.4 + (i % 3) * 0.2}
        />
      ))}

      {/* Moon */}
      <circle cx="1200" cy="120" r="50" fill="#1e4080" opacity="0.6" />
      <circle cx="1220" cy="105" r="44" fill="#0a1628" opacity="0.9" />

      {/* Mountains */}
      <polygon points="0,600 200,300 400,600" fill="#0d2347" opacity="0.9" />
      <polygon points="150,600 380,250 610,600" fill="#0f2a56" opacity="0.95" />
      <polygon points="350,600 600,280 850,600" fill="#0d2347" opacity="0.9" />
      <polygon points="600,600 880,220 1160,600" fill="#0a1e3d" opacity="0.95" />
      <polygon points="900,600 1100,320 1300,600" fill="#0d2347" opacity="0.9" />
      <polygon points="1100,600 1300,350 1440,600" fill="#0f2a56" opacity="0.9" />

      {/* Snow caps */}
      <polygon points="200,300 230,340 170,340" fill="white" opacity="0.15" />
      <polygon points="380,250 415,300 345,300" fill="white" opacity="0.15" />
      <polygon points="600,280 640,330 560,330" fill="white" opacity="0.15" />
      <polygon points="880,220 925,275 835,275" fill="white" opacity="0.15" />

      {/* Sea / horizon */}
      <rect x="0" y="580" width="1440" height="320" fill="url(#sea)" opacity="0.7" />

      {/* Sea shimmer lines */}
      {[...Array(8)].map((_, i) => (
        <line
          key={i}
          x1="0"
          y1={610 + i * 30}
          x2="1440"
          y2={615 + i * 30}
          stroke="white"
          strokeWidth="0.5"
          opacity="0.06"
        />
      ))}

      {/* Airplane silhouette */}
      <g transform="translate(300, 180) rotate(-15)" opacity="0.25">
        <ellipse cx="0" cy="0" rx="35" ry="7" fill="white" />
        <polygon points="-10,-7 10,-7 5,7 -5,7" fill="white" />
        <polygon points="-35,0 -20,-12 -15,0" fill="white" />
        <polygon points="35,0 20,-8 15,0" fill="white" />
        <polygon points="-5,7 5,7 2,14 -2,14" fill="white" />
      </g>

      {/* Hot air balloon */}
      <g transform="translate(1050, 200)" opacity="0.2">
        <ellipse cx="0" cy="0" rx="28" ry="35" fill="#1a5fa8" />
        <line x1="-15" y1="32" x2="-10" y2="50" stroke="white" strokeWidth="1" />
        <line x1="15" y1="32" x2="10" y2="50" stroke="white" strokeWidth="1" />
        <rect x="-12" y="50" width="24" height="14" rx="3" fill="#0d3366" />
        <line x1="-28" y1="0" x2="28" y2="0" stroke="white" strokeWidth="0.8" opacity="0.4" />
        <line x1="0" y1="-35" x2="0" y2="35" stroke="white" strokeWidth="0.8" opacity="0.4" />
      </g>

      {/* Compass rose */}
      <g transform="translate(100, 800)" opacity="0.12">
        <circle cx="0" cy="0" r="40" stroke="white" strokeWidth="1" fill="none" />
        <polygon points="0,-40 5,-10 0,40 -5,-10" fill="white" />
        <polygon points="40,0 10,5 -40,0 10,-5" fill="white" opacity="0.6" />
        <circle cx="0" cy="0" r="6" fill="white" />
        <text x="0" y="-46" textAnchor="middle" fill="white" fontSize="12" fontFamily="serif">N</text>
      </g>

      {/* Dark overlay for readability */}
      <rect width="1440" height="900" fill="#071220" opacity="0.55" />
    </svg>
  );
}

// ── Loading Screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#071220]">
      <TravelBackground />
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Spinner */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-blue-900/40" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-cyan-300 animate-spin [animation-duration:1.5s]" />
          {/* Plane icon in the center */}
          <div className="absolute inset-0 flex items-center justify-center text-2xl">✈️</div>
        </div>
        <p className="text-white text-lg font-medium tracking-wide animate-pulse">
          Generating Your Itinerary
        </p>
        <p className="text-blue-300 text-sm opacity-75">
          Crafting your perfect travel plan…
        </p>
      </div>
    </div>
  );
}

// ── Result View ───────────────────────────────────────────────────────────────

function ResultView({
  trip,
  onReset,
}: {
  trip: TripResult;
  onReset: () => void;
}) {
  return (
    <div className="min-h-screen w-full bg-[#071220] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1c36]/90 backdrop-blur border-b border-blue-900/40 shadow-lg">
        <div className="max-w-3xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-2xl font-bold text-blue-300 tracking-tight flex-1">
            ✈ KelanaAI
          </h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="bg-blue-800/60 border border-blue-600/40 px-3 py-1 rounded-full font-medium">
              📍 {trip.destination}
            </span>
            <span className="bg-blue-800/60 border border-blue-600/40 px-3 py-1 rounded-full font-medium">
              🗓 {trip.days} day{trip.days > 1 ? "s" : ""}
            </span>
            <span className="bg-blue-800/60 border border-blue-600/40 px-3 py-1 rounded-full font-medium">
              💰 {trip.currency} {trip.budget.toLocaleString()}
            </span>
            {trip.travel_style && (
              <span className="bg-cyan-800/60 border border-cyan-600/40 px-3 py-1 rounded-full font-medium">
                🎒 {trip.travel_style}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Trip meta badges */}
        <div className="flex flex-wrap gap-2 mb-6 text-xs">
          <span className="bg-blue-900/50 border border-blue-700/40 text-blue-200 px-3 py-1 rounded-full">
            {trip.category}
          </span>
          <span className="bg-blue-900/50 border border-blue-700/40 text-blue-200 px-3 py-1 rounded-full">
            {trip.recommendation_transport}
          </span>
          {trip.travel_season && (
            <span className="bg-blue-900/50 border border-blue-700/40 text-blue-200 px-3 py-1 rounded-full">
              {trip.travel_season}
            </span>
          )}
          <span className="bg-blue-900/50 border border-blue-700/40 text-blue-200 px-3 py-1 rounded-full">
            ~{trip.currency} {trip.daily_budget}/day
          </span>
        </div>

        {/* AI Recommendation — day cards */}
        {trip.ai_recommendation ? (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">
              ✦ AI Itinerary
            </p>
            {parseItinerary(trip.ai_recommendation).length > 0 ? (
              parseItinerary(trip.ai_recommendation).map((card, i) => (
                <DayCardView key={i} card={card} index={i} />
              ))
            ) : (
              // Fallback: raw text if parser finds no day structure
              <div className="bg-[#0d2044]/70 border border-blue-800/40 rounded-2xl p-6 text-blue-100 text-sm whitespace-pre-wrap leading-relaxed">
                {trip.ai_recommendation}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#0d2044]/70 border border-blue-800/40 rounded-2xl p-6">
            <p className="text-blue-300 italic text-sm">No itinerary generated yet.</p>
          </div>
        )}

        {/* Plan another trip button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={onReset}
            className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold shadow-lg shadow-blue-900/40 cursor-pointer"
          >
            ✈ Plan Another Trip
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Error View ────────────────────────────────────────────────────────────────

function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const isNetwork =
    message.toLowerCase().includes("fetch") ||
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("failed to fetch");

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <TravelBackground />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 text-center flex flex-col items-center gap-6">
        {/* Icon */}
        <div className="text-6xl">
          {isNetwork ? "📡" : "⚠️"}
        </div>

        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-red-300 mb-1">
            {isNetwork ? "Cannot reach the server" : "Something went wrong"}
          </h2>
          <p className="text-blue-200/60 text-sm">
            {isNetwork
              ? "Make sure the backend is running on localhost:8000"
              : "An error occurred while planning your trip"}
          </p>
        </div>

        {/* Error detail */}
        <div className="w-full bg-red-950/40 border border-red-700/40 rounded-xl px-5 py-4 text-red-300 text-sm text-left break-words">
          {message}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-sm shadow-lg cursor-pointer"
          >
            ← Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("form");
  const [trip, setTrip] = useState<TripResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("");
  const [budget, setBudget] = useState("");
  const [travelStyle, setTravelStyle] = useState("");
  const [travelMonth, setTravelMonth] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setView("loading");

    try {
      // 1. Create the trip
      const createRes = await fetch("/api/v1/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          days: parseInt(days),
          budget: parseFloat(budget),
          currency: "USD",
          travel_style: travelStyle || null,
          travel_month: travelMonth || null,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.detail || "Failed to create trip");
      }

      const created: TripResult = await createRes.json();

      // 2. Generate AI recommendation
      const generateRes = await fetch(
        `/api/v1/trips/${created.id}/generate`,
        { method: "POST" }
      );

      if (!generateRes.ok) {
        const err = await generateRes.json();
        throw new Error(err.detail || "Failed to generate itinerary");
      }

      const generated: TripResult = await generateRes.json();
      setTrip(generated);
      setView("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setView("error");
    }
  }

  function handleReset() {
    setTrip(null);
    setError(null);
    setDestination("");
    setDays("");
    setBudget("");
    setTravelStyle("");
    setTravelMonth("");
    setView("form");
  }

  if (view === "loading") return <LoadingScreen />;
  if (view === "result" && trip) return <ResultView trip={trip} onReset={handleReset} />;
  if (view === "error") return <ErrorView message={error ?? "Unknown error"} onRetry={handleReset} />;

  // ── Form ──
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <TravelBackground />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4 py-12">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold text-blue-300 tracking-tight drop-shadow-lg">
            KelanaAI
          </h1>
          <p className="text-blue-200/70 mt-2 text-sm tracking-wide">
            Your AI-powered travel planner
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0a1c36]/80 backdrop-blur-md border border-blue-800/40 rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-900/40 border border-red-700/50 px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Destination */}
            <div className="flex flex-col gap-1.5">
              <label className="text-blue-200 text-sm font-medium">
                Destination
              </label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Bali, Japan, Paris"
                className="w-full rounded-lg bg-blue-950/60 border border-blue-700/50 text-white placeholder-blue-400/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition"
              />
            </div>

            {/* Number of Days */}
            <div className="flex flex-col gap-1.5">
              <label className="text-blue-200 text-sm font-medium">
                Number of Days
              </label>
              <input
                type="number"
                required
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="e.g. 5"
                className="w-full rounded-lg bg-blue-950/60 border border-blue-700/50 text-white placeholder-blue-400/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition"
              />
            </div>

            {/* Budget */}
            <div className="flex flex-col gap-1.5">
              <label className="text-blue-200 text-sm font-medium">
                Budget (USD)
              </label>
              <input
                type="number"
                required
                min={1}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 2000"
                className="w-full rounded-lg bg-blue-950/60 border border-blue-700/50 text-white placeholder-blue-400/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition"
              />
            </div>

            {/* Travel Month (optional) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-blue-200 text-sm font-medium">
                Travel Month{" "}
                <span className="text-blue-400/60 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={travelMonth}
                onChange={(e) => setTravelMonth(e.target.value)}
                placeholder="e.g. June, December, 6"
                className="w-full rounded-lg bg-blue-950/60 border border-blue-700/50 text-white placeholder-blue-400/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition"
              />
            </div>

            {/* Travel Style */}
            <div className="flex flex-col gap-1.5">
              <label className="text-blue-200 text-sm font-medium">
                Travel Style
              </label>
              <select
                value={travelStyle}
                onChange={(e) => setTravelStyle(e.target.value)}
                className="w-full rounded-lg bg-blue-950/60 border border-blue-700/50 text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition appearance-none cursor-pointer"
              >
                <option value="" className="bg-[#0a1c36] text-blue-300">
                  Select a style…
                </option>
                <option value="Backpacker" className="bg-[#0a1c36]">Backpacker</option>
                <option value="Family" className="bg-[#0a1c36]">Family</option>
                <option value="Luxury" className="bg-[#0a1c36]">Luxury</option>
                <option value="Adventure" className="bg-[#0a1c36]">Adventure</option>
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="mt-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-base shadow-lg shadow-blue-900/50 cursor-pointer"
            >
              ✈ Generate Trip Report
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
