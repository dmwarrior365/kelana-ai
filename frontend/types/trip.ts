// ── Trip domain types ─────────────────────────────────────────────────────────

export type TripCategory = "Backpacker" | "Standard" | "Luxury";

export type TravelStyle = "Backpacker" | "Family" | "Solo" | "Couple" | "Luxury" | "Adventure";

export interface Trip {
  id: number;
  destination: string;
  days: number;
  budget: number;
  currency: string;
  daily_budget: number;
  travel_style: TravelStyle | null;
  travel_month: string | null;
  travel_season: string | null;
  category: TripCategory;
  recommendation_transport: string | null;
  ai_recommendation: string | null;
  created_at?: string;
}

export interface CreateTripPayload {
  destination: string;
  days: number;
  budget: number;
  currency?: string;
  travel_style?: TravelStyle | null;
  travel_month?: string | null;
}

// ── Sort / filter types used by the My Trips dashboard ───────────────────────

export type SortField = "created_at" | "budget";
export type SortOrder = "asc" | "desc";

export interface TripFilters {
  search: string;
  travelStyle: TravelStyle | "";
  sortField: SortField;
  sortOrder: SortOrder;
}
