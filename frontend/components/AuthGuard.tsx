"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Wrap any page that requires authentication.
 * While loading: shows a spinner.
 * Not logged in: redirects to /login.
 * Logged in: renders children.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071220]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-blue-900/40" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-spin" />
          </div>
          <p className="text-blue-400/60 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null; // redirect in flight

  return <>{children}</>;
}
