"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMe,
  login as loginService,
  logout as logoutService,
  register as registerService,
  getStoredToken,
} from "@/services/authService";
import type { AuthUser, LoginPayload, RegisterPayload } from "@/types/auth";

// ── Shape ─────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  /** true while the initial token check is running */
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: try to restore session from stored token
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe(token)
      .then(setUser)
      .catch(() => {
        // Token is expired or invalid — clear it silently
        logoutService();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const u = await loginService(payload);
    setUser(u);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await registerService(payload);
    // Auto-login after successful registration
    const u = await loginService({ email: payload.email, password: payload.password });
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    logoutService();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
