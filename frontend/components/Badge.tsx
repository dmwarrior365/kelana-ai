import type { TripCategory, TravelStyle } from "@/types/trip";

// ── Category badge ────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<TripCategory, string> = {
  Backpacker: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Standard:   "bg-blue-500/20  text-blue-300   border-blue-500/30",
  Luxury:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export function CategoryBadge({ category }: { category: TripCategory }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${CATEGORY_STYLES[category] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}
    >
      {category}
    </span>
  );
}

// ── Travel style badge ────────────────────────────────────────────────────────

const STYLE_STYLES: Partial<Record<TravelStyle, string>> = {
  Family:     "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Solo:       "bg-cyan-500/20   text-cyan-300   border-cyan-500/30",
  Couple:     "bg-pink-500/20   text-pink-300   border-pink-500/30",
  Backpacker: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Luxury:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Adventure:  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

const DEFAULT_STYLE_BADGE = "bg-slate-500/20 text-slate-300 border-slate-500/30";

export function TravelStyleBadge({ style }: { style: TravelStyle | string }) {
  const cls = STYLE_STYLES[style as TravelStyle] ?? DEFAULT_STYLE_BADGE;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}
    >
      {style}
    </span>
  );
}

// ── Generic pill badge ────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-blue-700/40 bg-blue-900/40 text-blue-200 ${className}`}
    >
      {children}
    </span>
  );
}
