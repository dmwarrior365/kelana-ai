import type { AuthUser, LoginPayload, RegisterPayload, TokenResponse } from "@/types/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
const AUTH_URL = `${API_BASE}/v1/auth`;

// ── Token storage (localStorage) ─────────────────────────────────────────────
// All reads are guarded against SSR (no window on the server).

const TOKEN_KEY = "kelana_access_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? body?.message ?? message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Register a new account. Returns the created user (no token — must log in). */
export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const res = await fetch(`${AUTH_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<AuthUser>(res);
}

/** Log in and persist the JWT to localStorage. Returns the decoded user. */
export async function login(payload: LoginPayload): Promise<AuthUser> {
  const res = await fetch(`${AUTH_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const { access_token } = await handleResponse<TokenResponse>(res);
  setStoredToken(access_token);
  // Fetch the user profile with the fresh token
  return fetchMe(access_token);
}

/** Fetch the current user profile using a given token (or the stored one). */
export async function fetchMe(token?: string): Promise<AuthUser> {
  const t = token ?? getStoredToken();
  if (!t) throw new Error("Not authenticated");
  const res = await fetch(`${AUTH_URL}/me`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return handleResponse<AuthUser>(res);
}

/** Clear the token. Call on logout. */
export function logout(): void {
  clearStoredToken();
}
