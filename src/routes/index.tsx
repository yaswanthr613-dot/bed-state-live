import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  BedDouble,
  Clock3,
  LogIn,
  LogOut,
  History as HistoryIcon,
  ShieldAlert,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isStaffOrAdmin } from "@/lib/use-auth";
import { HospitalFinder } from "@/components/HospitalFinder";
import { HospitalDetails } from "@/components/HospitalDetails";
import { HospitalBeds } from "@/components/HospitalBeds";
import type { NearbyHospital } from "@/lib/hospitals.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediSync — Real-time Hospital Bed Tracker" },
      {
        name: "description",
        content:
          "Find nearby hospitals and see real-time bed availability by type. Reserve one bed per device — synced live across every user.",
      },
      { property: "og:title", content: "MediSync — Real-time Hospital Bed Tracker" },
      {
        property: "og:description",
        content: "Live nearby-hospital bed map with one-bed-per-device reservation control.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MediSync,
});

function MediSync() {
  const [focused, setFocused] = useState<NearbyHospital | null>(null);
  const auth = useAuth();
  const staff = isStaffOrAdmin(auth.roles);

  return (
    <div className="min-h-screen text-foreground">
      <Toaster position="top-right" richColors />

      <header className="glass-strong sticky top-0 z-20 border-b border-border/60">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-cyan-400 to-violet-400 text-slate-950 shadow-lg shadow-primary/20">
            <Activity className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">MediSync</h1>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              Hospital capacity, in real time
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {auth.user ? (
              <>
                {staff && (
                  <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
                    <ShieldAlert className="h-3 w-3" /> {auth.roles.join(", ")}
                  </Badge>
                )}
                <Link to="/history">
                  <Button size="sm" variant="ghost" aria-label="Reservation history">
                    <HistoryIcon className="sm:mr-1" />
                    <span className="hidden sm:inline">History</span>
                  </Button>
                </Link>
                <Link to="/admin">
                  <Button size="sm" variant="ghost" className="hidden sm:inline-flex">
                    Admin
                  </Button>
                </Link>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {auth.user.email}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Sign out"
                  onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                >
                  <LogOut className="sm:mr-1" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button size="sm">
                  <LogIn className="sm:mr-1" />
                  <span className="hidden sm:inline">Sign in</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-2 pt-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-end md:pt-14">
          <div className="max-w-2xl">
            <Badge className="mb-4 gap-2 border border-primary/25 bg-primary/10 text-primary hover:bg-primary/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live community availability
            </Badge>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Find care with{" "}
              <span className="bg-gradient-to-r from-primary via-cyan-300 to-violet-300 bg-clip-text text-transparent">
                confidence.
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Compare nearby hospitals, check current bed capacity, and coordinate your next step in
              one place.
            </p>
          </div>
          <div className="glass hidden items-center gap-5 rounded-2xl px-5 py-3 md:flex">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BedDouble className="h-4 w-4 text-primary" />
              Live bed status
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4 text-violet-300" />
              Instant updates
            </div>
          </div>
        </section>

        <HospitalFinder selectedId={focused?.id ?? null} onSelect={setFocused} />

        {focused && <HospitalDetails hospital={focused} />}
        {focused && <HospitalBeds hospital={focused} />}
      </main>
    </div>
  );
}
