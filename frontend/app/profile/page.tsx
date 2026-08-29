"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import { getTrips } from "@/services/tripService";

// ── Profile content ───────────────────────────────────────────────────────────

function ProfileContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [tripCount, setTripCount] = useState<number | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);

  useEffect(() => {
    getTrips()
      .then((trips) => setTripCount(trips.length))
      .catch(() => setTripCount(0))
      .finally(() => setLoadingTrips(false));
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-[#071220] text-white">
      {/* Navbar */}
      <div className="sticky top-0 z-20 bg-[#071220]/90 backdrop-blur border-b border-blue-900/40 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-14">
          <Link href="/" className="text-blue-300 font-extrabold text-xl tracking-tight shrink-0">
            ✈ KelanaAI
          </Link>
          <span className="text-blue-700/60 select-none hidden sm:block">›</span>
          <span className="text-blue-200/70 text-sm hidden sm:block">Profile</span>

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="text-blue-300/70 text-xs hidden sm:block">
                Welcome back, {firstName} 👋
              </span>
            )}
            <Link
              href="/trips"
              className="text-xs text-blue-400/60 hover:text-blue-300 transition"
            >
              My Trips
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-blue-400/60 hover:text-red-400 transition cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Welcome header */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-blue-300/60 text-sm mt-1">Your KelanaAI profile</p>
        </div>

        {/* Avatar + info card */}
        <div className="bg-[#0a1c36]/80 border border-blue-800/40 rounded-2xl p-8 shadow-xl mb-6">
          {/* Avatar */}
          <div className="flex items-center gap-5 mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/30 border-2 border-blue-500/40 text-2xl font-bold text-blue-200 select-none shrink-0">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold text-xl">{user?.name}</p>
              <p className="text-blue-300/60 text-sm">{user?.email}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Name */}
            <div className="bg-blue-950/50 border border-blue-800/40 rounded-xl p-4">
              <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1.5">
                Name
              </p>
              <p className="text-white font-medium text-sm truncate">{user?.name}</p>
            </div>

            {/* Email */}
            <div className="bg-blue-950/50 border border-blue-800/40 rounded-xl p-4">
              <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1.5">
                Email
              </p>
              <p className="text-white font-medium text-sm truncate">{user?.email}</p>
            </div>

            {/* Trip count */}
            <div className="bg-blue-950/50 border border-blue-800/40 rounded-xl p-4">
              <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1.5">
                Trips Generated
              </p>
              {loadingTrips ? (
                <div className="h-5 w-8 rounded bg-blue-800/40 animate-pulse" />
              ) : (
                <p className="text-white font-bold text-2xl">{tripCount ?? 0}</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-semibold text-sm shadow-md shadow-blue-900/30"
          >
            ✈ Plan a Trip
          </Link>
          <Link
            href="/trips"
            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 active:scale-95 transition-all text-white font-semibold text-sm"
          >
            🗺️ My Trips
          </Link>
          <button
            onClick={handleLogout}
            className="px-6 py-2.5 rounded-full bg-red-900/30 hover:bg-red-800/40 border border-red-700/30 active:scale-95 transition-all text-red-300 font-semibold text-sm cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
