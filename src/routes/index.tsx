import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, LogIn, LogOut, History as HistoryIcon, ShieldAlert } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isStaffOrAdmin } from "@/lib/use-auth";
import { HospitalFinder } from "@/components/HospitalFinder";
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
    ],
  }),
  component: MediSync,
});

function MediSync() {
  const [focused, setFocused] = useState<NearbyHospital | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors />

      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">MediSync</h1>
            <p className="text-xs text-muted-foreground">
              Real-time hospital bed tracker
            </p>
          </div>
        </div>
      </header>

      <HospitalFinder selectedId={focused?.id ?? null} onSelect={setFocused} />

      {focused && <HospitalBeds hospital={focused} />}
    </div>
  );
}
