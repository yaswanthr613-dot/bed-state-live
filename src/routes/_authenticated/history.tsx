import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listBedEvents, type BedEvent } from "@/lib/hospitals.functions";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Activity, ArrowLeft, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Your reservation history — MediSync" },
      { name: "description", content: "Review your recent hospital bed reservations and releases." },
      { property: "og:title", content: "Reservation history — MediSync" },
      { property: "og:description", content: "Your recent hospital bed reservation activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const auth = useAuth();
  const list = useServerFn(listBedEvents);
  const [events, setEvents] = useState<BedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.user) return;
    list({ data: { actorUserId: auth.user.id, limit: 100 } })
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [auth.user, list]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <header className="border-b bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <h1 className="font-semibold">Your reservation history</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <Button size="sm" variant="ghost" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Latest activity for {auth.user?.email}</h2>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven't reserved or released any beds yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      <Badge variant="outline" className="mr-2 capitalize">{e.action.replace("_", " ")}</Badge>
                      {e.hospital_name}
                    </div>
                    {e.bed_number != null && (
                      <div className="text-xs text-muted-foreground">
                        Bed #{e.bed_number} · {e.bed_type}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
