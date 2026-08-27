"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTrip } from "@/services/tripService";
import { CategoryBadge, TravelStyleBadge, Badge } from "@/components/Badge";
import { formatBudget } from "@/components/TripCard";
import type { Trip } from "@/types/trip";

// ── Markdown parser (shared logic, self-contained here for the detail view) ───

interface TimeBlock { label: string; items: string[] }
interface DayCard   { title: string; blocks: TimeBlock[] }

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
      const text = line.replace(/^\s*[-*+]\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1").trim();
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

function blockStyle(label: string) {
  const l = label.toLowerCase();
  if (l.includes("morning"))                          return { icon: "🌅", border: "border-amber-500/30",  bg: "bg-amber-500/10",  text: "text-amber-300",  dot: "bg-amber-400"  };
  if (l.includes("midday") || l.includes("lunch"))   return { icon: "☀️", border: "border-yellow-400/30", bg: "bg-yellow-400/10", text: "text-yellow-300", dot: "bg-yellow-400" };
  if (l.includes("afternoon") || l.includes("late")) return { icon: "🌤", border: "border-orange-400/30", bg: "bg-orange-400/10", text: "text-orange-300", dot: "bg-orange-400" };
  if (l.includes("evening") || l.includes("night"))  return { icon: "🌙", border: "border-indigo-400/30", bg: "bg-indigo-400/10", text: "text-indigo-300", dot: "bg-indigo-400" };
  return { icon: "📌", border: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-300", dot: "bg-blue-400" };
}

// ── Day accordion card ────────────────────────────────────────────────────────

function DayAccordion({ card, index }: { card: DayCard; index: number }) {
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

// ── Info grid ─────────────────────────────────────────────────────────────────

function InfoGrid({ trip }: { trip: Trip }) {
  const cells = [
    {
      label: "DESTINATION",
      value: (
        <span className="text-white font-medium">{trip.destination}</span>
      ),
    },
    {
      label: "BUDGET",
      value: (
        <span className="text-white font-medium">{formatBudget(trip.currency, trip.budget)}</span>
      ),
    },
    {
      label: "CATEGORY",
      value: (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-medium">{trip.category}</span>
          <CategoryBadge category={trip.category} />
        </div>
      ),
    },
    {
      label: "DAYS",
      value: (
        <span className="text-white font-medium">{trip.days} day{trip.days !== 1 ? "s" : ""}</span>
      ),
    },
    {
      label: "TRAVEL STYLE",
      value: trip.travel_style ? (
        <TravelStyleBadge style={trip.travel_style} />
      ) : (
        <span className="text-blue-400/50 italic text-sm">Not specified</span>
      ),
    },
    {
      label: "DAILY BUDGET",
      value: (
        <span className="text-white font-medium">
          {formatBudget(trip.currency, Math.round(trip.daily_budget))} / day
        </span>
      ),
    },
    ...(trip.recommendation_transport ? [{
      label: "TRANSPORT",
      value: <span className="text-white font-medium">{trip.recommendation_transport}</span>,
    }] : []),
    ...(trip.travel_season ? [{
      label: "SEASON",
      value: <Badge>{trip.travel_season}</Badge>,
    }] : []),
    ...(trip.travel_month ? [{
      label: "TRAVEL MONTH",
      value: <span className="text-white font-medium">{trip.travel_month}</span>,
    }] : []),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-[#0a1c36]/70 border border-blue-800/40 rounded-xl p-4">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1.5">{cell.label}</p>
          <div className="text-sm">{cell.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TripDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-blue-900/30" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-blue-900/20" />)}
      </div>
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-blue-900/20" />)}
      </div>
    </div>
  );
}

// ── Trip detail page ──────────────────────────────────────────────────────────

// params is a Promise in this Next.js version — we use use() to unwrap it
export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();

  const [trip, setTrip]       = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTrip(id)
      .then(setTrip)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const days = trip ? parseItinerary(trip.ai_recommendation ?? "") : [];

  return (
    <div className="min-h-screen bg-[#071220] text-white">
      {/* Top nav */}
      <div className="sticky top-0 z-20 bg-[#071220]/90 backdrop-blur border-b border-blue-900/40 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center gap-3 h-14">
          <Link href="/" className="text-blue-300 font-extrabold text-xl tracking-tight shrink-0">
            ✈ KelanaAI
          </Link>
          <span className="text-blue-700/60 select-none hidden sm:block">›</span>
          <Link href="/trips" className="text-blue-200/70 text-sm hidden sm:block hover:text-blue-200 transition">
            My Trips
          </Link>
          {trip && (
            <>
              <span className="text-blue-700/60 select-none hidden sm:block">›</span>
              <span className="text-white text-sm font-medium hidden sm:block truncate max-w-[200px]">{trip.destination}</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-xs text-blue-400/60 hover:text-blue-300 transition cursor-pointer"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && <TripDetailSkeleton />}

      {/* Error */}
      {!loading && error && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-300 mb-2">Failed to load trip</h2>
          <p className="text-red-300/70 text-sm mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setError(null); setLoading(true); getTrip(id).then(setTrip).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }} className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold cursor-pointer transition">
              Retry
            </button>
            <Link href="/trips" className="px-5 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition">
              ← My Trips
            </Link>
          </div>
        </div>
      )}

      {/* Trip detail */}
      {!loading && trip && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            {trip.destination}
          </h1>
          <p className="text-blue-300/60 text-sm mb-8">
            Trip #{trip.id}
            {trip.created_at && (
              <> · Planned {new Date(trip.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</>
            )}
          </p>

          {/* Info grid */}
          <InfoGrid trip={trip} />

          {/* AI recommendation */}
          <div className="mb-4 flex items-center gap-3">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">AI Recommendation</p>
            <div className="flex-1 h-px bg-blue-800/40" />
          </div>

          {trip.ai_recommendation ? (
            days.length > 0 ? (
              <div className="flex flex-col gap-4">
                {days.map((card, i) => <DayAccordion key={i} card={card} index={i} />)}
              </div>
            ) : (
              <div className="bg-[#0d2044]/70 border border-blue-800/40 rounded-2xl p-6 text-blue-100 text-sm whitespace-pre-wrap leading-relaxed">
                {trip.ai_recommendation}
              </div>
            )
          ) : (
            <div className="bg-[#0d2044]/70 border border-blue-800/40 rounded-2xl p-6">
              <p className="text-blue-300/60 italic text-sm">No itinerary generated yet.</p>
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <Link
              href="/trips"
              className="px-7 py-3 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 active:scale-95 transition-all text-white font-semibold text-sm"
            >
              ← My Trips
            </Link>
            <Link
              href="/"
              className="px-7 py-3 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-sm shadow-md shadow-blue-900/30"
            >
              ✈ Plan Another Trip
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
