"use client";

import Link from "next/link";
import type { Trip, TripCategory } from "@/types/trip";
import { CategoryBadge, TravelStyleBadge } from "@/components/Badge";

// ── Destination icon map ──────────────────────────────────────────────────────
// Simple emoji landmark/flag lookup; falls back to ✈️ for unknown destinations.

const DESTINATION_ICONS: Record<string, string> = {
  japan:       "🗼",
  tokyo:       "🗼",
  kyoto:       "⛩️",
  bali:        "🌴",
  indonesia:   "🌴",
  singapore:   "🦁",
  paris:       "🗼",
  france:      "🇫🇷",
  london:      "🇬🇧",
  uk:          "🇬🇧",
  "new york":  "🗽",
  usa:         "🇺🇸",
  america:     "🇺🇸",
  rome:        "🏛️",
  italy:       "🇮🇹",
  bangkok:     "🛕",
  thailand:    "🇹🇭",
  dubai:       "🏙️",
  uae:         "🇦🇪",
  sydney:      "🦘",
  australia:   "🦘",
  barcelona:   "🇪🇸",
  spain:       "🇪🇸",
  amsterdam:   "🇳🇱",
  berlin:      "🇩🇪",
  germany:     "🇩🇪",
  seoul:       "🇰🇷",
  korea:       "🇰🇷",
  beijing:     "🏯",
  china:       "🇨🇳",
  maldives:    "🏝️",
  greece:      "🏛️",
  santorini:   "🏛️",
  prague:      "🇨🇿",
  istanbul:    "🕌",
  turkey:      "🇹🇷",
  cairo:       "🏺",
  egypt:       "🏺",
  morocco:     "🕌",
  india:       "🇮🇳",
  mumbai:      "🇮🇳",
  delhi:       "🇮🇳",
  vietnam:     "🇻🇳",
  hanoi:       "🇻🇳",
  malaysia:    "🇲🇾",
  kuala:       "🇲🇾",
  philippines: "🇵🇭",
  manila:      "🇵🇭",
  mexico:      "🇲🇽",
  brazil:      "🇧🇷",
  switzerland: "🇨🇭",
  zurich:      "🇨🇭",
  vienna:      "🇦🇹",
  austria:     "🇦🇹",
};

function getDestinationIcon(destination: string): string {
  const lower = destination.toLowerCase();
  for (const [key, icon] of Object.entries(DESTINATION_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "✈️";
}

// ── Budget formatting ─────────────────────────────────────────────────────────

export function formatBudget(currency: string, budget: number): string {
  return `${currency} ${budget.toLocaleString("en-US")}`;
}

// ── Category icon ─────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<TripCategory, string> = {
  Backpacker: "🎒",
  Standard:   "💼",
  Luxury:     "💎",
};

// ── TripCard component ────────────────────────────────────────────────────────

interface TripCardProps {
  trip: Trip;
}

export default function TripCard({ trip }: TripCardProps) {
  const destinationIcon = getDestinationIcon(trip.destination);
  const categoryIcon = CATEGORY_ICON[trip.category] ?? "🗺️";

  return (
    <div className="flex items-center gap-4 bg-[#0d2044]/60 border border-blue-800/40 rounded-2xl px-5 py-4 shadow-md hover:border-blue-600/50 hover:bg-[#0d2044]/80 transition-all group">
      {/* Destination icon circle */}
      <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-blue-800/40 border border-blue-700/40 text-2xl select-none">
        {destinationIcon}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-white font-semibold text-base truncate">
            {trip.destination}
          </span>
          <CategoryBadge category={trip.category} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-blue-200/70">
          <span>
            {trip.days} day{trip.days !== 1 ? "s" : ""}
          </span>
          <span className="text-blue-700/60 select-none">·</span>
          <span>{formatBudget(trip.currency, trip.budget)}</span>
          <span className="text-blue-700/60 select-none">·</span>
          {trip.travel_style ? (
            <TravelStyleBadge style={trip.travel_style} />
          ) : (
            <span className="text-blue-400/50 italic text-xs">No style</span>
          )}
        </div>
        {/* Extra meta row: transport + season */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-blue-400/60">
          {trip.recommendation_transport && (
            <span>{categoryIcon} {trip.recommendation_transport}</span>
          )}
          {trip.travel_season && <span>🌏 {trip.travel_season}</span>}
          {trip.travel_month && <span>📅 {trip.travel_month}</span>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Quick chat access — opens a new chat so the user can ask about this trip */}
        <Link
          href="/chat"
          title={`Chat about ${trip.destination}`}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-800/40 hover:bg-blue-700/60 border border-blue-700/40 hover:border-blue-500/60 active:scale-95 transition-all text-blue-300 hover:text-white"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9.5l-1.5 2-1.5-2H3a1 1 0 01-1-1V3z" />
          </svg>
        </Link>

        {/* View Details */}
        <Link
          href={`/trips/${trip.id}`}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white text-sm font-semibold shadow-md shadow-blue-900/30 whitespace-nowrap"
        >
          View Details
          <span className="text-xs">→</span>
        </Link>
      </div>
    </div>
  );
}
