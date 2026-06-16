import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listBedEvents, type BedEvent } from "@/lib/hospitals.functions";
import { useAuth, isStaffOrAdmin } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Activity, ArrowLeft, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MediSync" }] }),
  component: AdminPage,
});

function AdminPage() {
  const auth = useAuth();
  const list = useServerFn(listBedEvents);
  const [events, setEvents] = useState<BedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    list({ data: { limit: 100 } })
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [list]);

  // Realtime feed
  useEffect(() => {
    const channel = supabase
      .channel("admin-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bed_events" }, (payload) => {
        setEvents((prev) => [payload.new as BedEvent, ...prev].slice(0, 100));
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, []);

  async function grantStaffSelf() {
    if (!auth.user) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: auth.user.id, role: "staff" });
    if (error) toast.error(error.message);
    else {
      toast.success("Staff role granted to you — refresh to apply");
      setTimeout(() => window.location.reload(), 800);
    }
  }

  if (auth.loading) return <p className="p-8 text-sm">Loading…</p>;

  const canSee = isStaffOrAdmin(auth.roles);

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <header className="border-b bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <h1 className="font-semibold">Admin · Live operations feed</h1>
            <Badge variant="outline" className="capitalize">{auth.roles.join(", ") || "patient"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/history" className="text-sm text-muted-foreground hover:text-foreground">My history</Link>
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {!canSee ? (
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-500" />
              <div className="space-y-3">
                <div>
                  <h2 className="font-semibold">You're signed in as a patient</h2>
                  <p className="text-sm text-muted-foreground">
                    Admin & staff features (managing occupancy, emergency mode, live feed) require
                    elevated roles.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Demo: grant yourself the staff role to explore the dashboard.
                </p>
                <Button size="sm" onClick={grantStaffSelf}>Grant me staff role (demo)</Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Latest bed events (all hospitals)</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <ul className="divide-y divide-border">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <Badge variant="outline" className="mr-2 capitalize">{e.action.replace("_", " ")}</Badge>
                      <span className="font-medium">{e.hospital_name}</span>
                      {e.bed_number != null && (
                        <span className="text-muted-foreground"> · Bed #{e.bed_number} ({e.bed_type})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{e.actor_user_id ? `user ${e.actor_user_id.slice(0, 8)}` : "system"}</span>
                      <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                    </div>
                  </li>
                ))}
                {events.length === 0 && <p className="py-3 text-sm text-muted-foreground">No events yet.</p>}
              </ul>
            )}
          </Card>
        )}

      </main>
    </div>
  );
}
