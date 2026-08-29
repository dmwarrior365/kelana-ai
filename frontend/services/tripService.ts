import type { Trip, CreateTripPayload } from "@/types/trip";
import { getStoredToken } from "@/services/authService";

// ── Base URL ──────────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
const TRIPS_URL = `${API_BASE}/v1/trips`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? body?.message ?? message;
    } catch {
      // ignore parse error; use default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/** Build headers that always include the stored JWT when available. */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getStoredToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch the trips owned by the current user. */
export async function getTrips(): Promise<Trip[]> {
  const res = await fetch(TRIPS_URL, {
    cache: "no-store",
    headers: authHeaders(),
  });
  return handleResponse<Trip[]>(res);
}

/** Fetch a single trip by ID (must be owned by the current user). */
export async function getTrip(id: number | string): Promise<Trip> {
  const res = await fetch(`${TRIPS_URL}/${id}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  return handleResponse<Trip>(res);
}

/**
 * Create a trip and then trigger AI generation.
 * Returns the fully-generated trip object.
 */
export async function generateTrip(payload: CreateTripPayload): Promise<Trip> {
  // Step 1 — create the record
  const createRes = await fetch(TRIPS_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      ...payload,
      currency: payload.currency ?? "USD",
    }),
  });
  const created = await handleResponse<Trip>(createRes);

  // Step 2 — generate AI recommendation
  const generateRes = await fetch(`${TRIPS_URL}/${created.id}/generate`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<Trip>(generateRes);
}

/** Delete a trip by ID. */
export async function deleteTrip(id: number | string): Promise<void> {
  const res = await fetch(`${TRIPS_URL}/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}
