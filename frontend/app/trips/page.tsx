"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTrips } from "@/services/tripService";
import TripCard from "@/components/TripCard";
import { EmptyState } from "@/components/EmptyState";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import type { Trip, TravelStyle, SortField, SortOrder } from "@/types/trip";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const TRAVEL_STYLES: TravelStyle[] = ["Backpacker", "Family", "Solo", "Couple", "Luxury", "Adventure"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortTrips(trips: Trip[], field: SortField, order: SortOrder): Trip[] {
  return [...trips].sort((a, b) => {
    let cmp = 0;
    if (field === "budget") {
      cmp = a.budget - b.budget;
    } else {
      // created_at — fall back to id if missing
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
  { label: "Latest first",   field: "created_at", order: "desc" },
  { label: "Oldest first",   field: "created_at", order: "asc"  },
  { label: "Highest budget", field: "budget",     order: "desc" },
  { label: "Lowest budget",  field: "budget",     order: "asc"  },
];

function SortDropdown({
  sortField, sortOrder, onSortField, onSortOrder,
}: {
  sortField: SortField; sortOrder: SortOrder;
  onSortField: (v: SortField) => void; onSortOrder: (v: SortOrder) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = SORT_OPTIONS.find((o) => o.field === sortField && o.order === sortOrder) ?? SORT_OPTIONS[0];

  function pick(opt: SortOption) { onSortField(opt.field); onSortOrder(opt.order); setOpen(false); }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-sort-dropdown]")) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" data-sort-dropdown="">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-950/60 border border-blue-700/50 text-blue-200 text-sm font-medium hover:bg-blue-800/40 hover:border-blue-500/60 transition-all cursor-pointer select-none"
      >
        <span className="text-blue-400/70 text-xs">Sort by</span>
        <span className="text-white font-semibold">{active.label}</span>
        <svg className={`w-3.5 h-3.5 text-blue-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 12 8" fill="none">
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-2xl bg-[#0d1e3d] border border-blue-700/50 shadow-2xl shadow-black/40 overflow-hidden">
          {SORT_OPTIONS.map((opt, i) => {
            const isActive = opt.field === sortField && opt.order === sortOrder;
            return (
              <button
                key={opt.label}
                onClick={() => pick(opt)}
                className={`w-full text-left px-5 py-3.5 text-sm font-medium transition-colors cursor-pointer
                  ${i !== SORT_OPTIONS.length - 1 ? "border-b border-blue-800/40" : ""}
                  ${isActive ? "bg-blue-500/20 text-blue-300" : "text-blue-100/80 hover:bg-blue-800/30 hover:text-white"}`}
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

// ── Search + filter bar ───────────────────────────────────────────────────────

interface FilterBarProps {
  search: string; onSearch: (v: string) => void;
  styleFilter: TravelStyle | ""; onStyleFilter: (v: TravelStyle | "") => void;
  sortField: SortField; onSortField: (v: SortField) => void;
  sortOrder: SortOrder; onSortOrder: (v: SortOrder) => void;
  total: number; filtered: number;
}

function FilterBar({ search, onSearch, styleFilter, onStyleFilter, sortField, onSortField, sortOrder, onSortOrder, total, filtered }: FilterBarProps) {
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
        <select
          value={styleFilter} onChange={(e) => onStyleFilter(e.target.value as TravelStyle | "")}
          className="rounded-xl bg-blue-950/60 border border-blue-700/50 text-white text-sm px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition appearance-none cursor-pointer"
        >
          <option value="" className="bg-[#0a1c36]">All Styles</option>
          {TRAVEL_STYLES.map((s) => <option key={s} value={s} className="bg-[#0a1c36]">{s}</option>)}
        </select>

        {/* Custom sort dropdown */}
        <SortDropdown
          sortField={sortField} sortOrder={sortOrder}
          onSortField={onSortField} onSortOrder={onSortOrder}
        />
      </div>

      <p className="mt-3 text-xs text-blue-400/60">
        {filtered === total ? `${total} saved itinerar${total === 1 ? "y" : "ies"}` : `${filtered} of ${total} trips`}
      </p>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const btnBase = "flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer";
  const active  = "bg-blue-600 text-white shadow";
  const inactive = "text-blue-300/70 hover:bg-blue-800/40 hover:text-white";

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8">
      <button onClick={() => onPage(page - 1)} disabled={page === 1} className={`${btnBase} ${page === 1 ? "opacity-30 cursor-not-allowed" : inactive}`}>‹</button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-blue-400/50 text-sm">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p as number)} className={`${btnBase} ${page === p ? active : inactive}`}>{p}</button>
        )
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className={`${btnBase} ${page === totalPages ? "opacity-30 cursor-not-allowed" : inactive}`}>›</button>
    </div>
  );
}

// ── My Trips page ─────────────────────────────────────────────────────────────

function TripsPageContent() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }
  const [trips, setTrips]           = useState<Trip[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Filters
  const [search, setSearch]           = useState("");
  const [styleFilter, setStyleFilter] = useState<TravelStyle | "">("");
  const [sortField, setSortField]     = useState<SortField>("created_at");
  const [sortOrder, setSortOrder]     = useState<SortOrder>("desc");

  // Pagination
  const [page, setPage] = useState(1);

  // Fetch trips
  async function fetchTrips() {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrips();
      // Newest first by default (highest id at top)
      setTrips(data.sort((a, b) => b.id - a.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrips();
  }, []);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, styleFilter, sortField, sortOrder]);

  // Apply filters + sort
  const filtered = useMemo(() => {
    let result = trips;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) => t.destination.toLowerCase().includes(q));
    }

    if (styleFilter) {
      result = result.filter((t) => t.travel_style === styleFilter);
    }

    return sortTrips(result, sortField, sortOrder);
  }, [trips, search, styleFilter, sortField, sortOrder]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Render ──

  return (
    <div className="min-h-screen bg-[#071220] text-white">
      {/* Top nav */}
      <div className="sticky top-0 z-20 bg-[#071220]/90 backdrop-blur border-b border-blue-900/40 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-14">
          <Link href="/" className="text-blue-300 font-extrabold text-xl tracking-tight shrink-0">
            ✈ KelanaAI
          </Link>
          <span className="text-blue-700/60 select-none hidden sm:block">›</span>
          <span className="text-blue-200/70 text-sm hidden sm:block">My Trips</span>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="text-blue-300/70 text-xs hidden sm:block">
                Welcome back, {user.name.split(" ")[0]} 👋
              </span>
            )}
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
            <Link href="/" className="text-xs text-blue-400/60 hover:text-blue-300 transition">
              ← Home
            </Link>
          </div>
        </div>
      </div>

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
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white text-sm font-semibold shadow-md shadow-blue-900/30"
          >
            + New Trip
          </Link>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-blue-900/20 border border-blue-800/30 animate-pulse" />
            ))}
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

        {/* Empty state — no trips at all */}
        {!loading && !error && trips.length === 0 && (
          <EmptyState
            icon="🗺️"
            title="No trips yet"
            description="You haven't planned any trips yet. Start by generating your first AI itinerary!"
            action={{ label: "✈ Plan your first trip", href: "/" }}
          />
        )}

        {/* Content — trips exist */}
        {!loading && !error && trips.length > 0 && (
          <>
            <FilterBar
              search={search}          onSearch={setSearch}
              styleFilter={styleFilter} onStyleFilter={setStyleFilter}
              sortField={sortField}     onSortField={setSortField}
              sortOrder={sortOrder}     onSortOrder={setSortOrder}
              total={trips.length}      filtered={filtered.length}
            />

            {/* Empty state — filters returned nothing */}
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
                  {paginated.map((trip) => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
                <Pagination page={page} totalPages={totalPages} onPage={setPage} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TripsPage() {
  return (
    <AuthGuard>
      <TripsPageContent />
    </AuthGuard>
  );
}