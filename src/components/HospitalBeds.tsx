import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureHospitalBeds,
  reserveBedAsUser,
  releaseMyBedAsUser,
  setBedOccupancy,
  toggleEmergencyMode,
  getHospitalState,
  listBedEvents,
  estimateBeds,
  type Bed,
  type BedEvent,
  type NearbyHospital,
} from "@/lib/hospitals.functions";
import { useAuth, isStaffOrAdmin } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BedDouble, Shield, X, AlertTriangle, Users, History, Lock } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

const STATUS_LABEL: Record<Bed["status"], string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
};
const TYPE_ORDER: Record<Bed["bed_type"], number> = { ICU: 0, ER: 1, WARD: 2 };

export function HospitalBeds({ hospital }: { hospital: NearbyHospital }) {
  const auth = useAuth();
  const staffMode = isStaffOrAdmin(auth.roles);

  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [emergencyOn, setEmergencyOn] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const [events, setEvents] = useState<BedEvent[]>([]);
  const [tab, setTab] = useState<"beds" | "history">("beds");

  const ensure = useServerFn(ensureHospitalBeds);
  const reserve = useServerFn(reserveBedAsUser);
  const release = useServerFn(releaseMyBedAsUser);
  const setOcc = useServerFn(setBedOccupancy);
  const toggleEmer = useServerFn(toggleEmergencyMode);
  const getState = useServerFn(getHospitalState);
  const listEvents = useServerFn(listBedEvents);

  // Load / seed beds + hospital state
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBeds([]);
    const totalBeds = estimateBeds(hospital.id);
    Promise.all([
      ensure({ data: { placeId: hospital.id, hospitalName: hospital.name, totalBeds } }),
      getState({ data: { placeId: hospital.id } }),
    ])
      .then(([rows, state]) => {
        if (cancelled) return;
        setBeds(rows);
        setEmergencyOn(state?.emergency_mode ?? false);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Couldn't load hospital data");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hospital.id, hospital.name, ensure, getState]);

  // Load events on tab change
  useEffect(() => {
    if (tab !== "history") return;
    listEvents({ data: { placeId: hospital.id, limit: 50 } })
      .then(setEvents)
      .catch((e) => console.error(e));
  }, [tab, hospital.id, listEvents]);

  // Realtime: beds
  useEffect(() => {
    const channel = supabase
      .channel(`beds:${hospital.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hospital_beds", filter: `place_id=eq.${hospital.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") setBeds((prev) => [...prev, payload.new as Bed]);
          else if (payload.eventType === "UPDATE") {
            const next = payload.new as Bed;
            setBeds((prev) => prev.map((b) => (b.id === next.id ? next : b)));
          }
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [hospital.id]);

  // Realtime: hospital_state (emergency mode)
  useEffect(() => {
    const channel = supabase
      .channel(`state:${hospital.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hospital_state", filter: `place_id=eq.${hospital.id}` },
        (payload) => {
          const next = payload.new as { emergency_mode?: boolean } | null;
          if (next && typeof next.emergency_mode === "boolean") setEmergencyOn(next.emergency_mode);
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [hospital.id]);

  // Realtime: bed_events (live history feed)
  useEffect(() => {
    const channel = supabase
      .channel(`events:${hospital.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bed_events", filter: `place_id=eq.${hospital.id}` },
        (payload) => setEvents((prev) => [payload.new as BedEvent, ...prev].slice(0, 50)),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [hospital.id]);

  // Presence: live connected users for this hospital
  useEffect(() => {
    const userKey = auth.user?.id ?? `anon-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase.channel(`presence:${hospital.id}`, {
      config: { presence: { key: userKey } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPresenceCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => void supabase.removeChannel(channel);
  }, [hospital.id, auth.user?.id]);

  const stats = useMemo(() => {
    const s = { available: 0, reserved: 0, occupied: 0 };
    beds.forEach((b) => s[b.status]++);
    return s;
  }, [beds]);

  const myReservation = beds.find(
    (b) => auth.user && b.reserved_by_user === auth.user.id && b.status === "reserved",
  );
  const occupancyPct = beds.length
    ? Math.round(((stats.occupied + stats.reserved) / beds.length) * 100)
    : 0;

  const grouped = useMemo(() => {
    const map = new Map<Bed["bed_type"], Bed[]>();
    beds.forEach((b) => {
      const arr = map.get(b.bed_type) ?? [];
      arr.push(b);
      map.set(b.bed_type, arr);
    });
    return Array.from(map.entries())
      .sort((a, b) => TYPE_ORDER[a[0]] - TYPE_ORDER[b[0]])
      .map(([type, arr]) => ({ type, beds: arr.sort((a, b) => a.bed_number - b.bed_number) }));
  }, [beds]);

  async function onBedClick(bed: Bed) {
    if (!auth.user) {
      toast.error("Sign in to reserve a bed");
      return;
    }
    // Staff/admin: tap toggles available/occupied
    if (staffMode) {
      if (bed.status === "reserved") {
        toast.error("Bed is currently reserved by a user");
        return;
      }
      const next = bed.status === "available" ? "occupied" : "available";
      try {
        const res = await setOcc({ data: { bedId: bed.id, status: next } });
        if (!res.ok) toast.error("Permission denied");
        else toast.success(`Bed #${bed.bed_number} marked ${next}`);
      } catch (e) {
        console.error(e);
        toast.error("Update failed");
      }
      return;
    }
    // Patient flow
    if (bed.status === "occupied") {
      toast.error("Bed is occupied");
      return;
    }
    if (bed.reserved_by_user === auth.user.id) {
      try {
        await release({});
        toast.success("Reservation released");
      } catch (e) {
        console.error(e);
        toast.error("Couldn't release");
      }
      return;
    }
    if (bed.status === "reserved") {
      toast.error("Reserved by another user");
      return;
    }
    try {
      const res = await reserve({ data: { bedId: bed.id } });
      if (!res.ok) {
        toast.error(res.reason === "auth" ? "Sign in required" : "That bed was just taken");
        return;
      }
      toast.success(myReservation ? `Moved your reservation to bed ${bed.bed_number}` : `Bed ${bed.bed_number} reserved`);
    } catch (e) {
      console.error(e);
      toast.error("Reservation failed");
    }
  }

  async function releaseMine() {
    try {
      await release({});
      toast.success("Reservation released");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't release");
    }
  }

  async function onToggleEmergency() {
    try {
      const res = await toggleEmer({
        data: { placeId: hospital.id, hospitalName: hospital.name, on: !emergencyOn },
      });
      if (!res.ok) toast.error("Permission denied");
      else toast.success(emergencyOn ? "Emergency mode cleared" : "Emergency mode activated");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't toggle emergency mode");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pb-12 pt-8">
      <Card className={`p-5 ${emergencyOn ? "border-rose-500/60 ring-2 ring-rose-500/30" : ""}`}>
        {emergencyOn && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-rose-500/15 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" />
            <strong>Emergency Mode active</strong> — available ward beds are temporarily locked.
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{hospital.name}</h2>
            <p className="text-xs text-muted-foreground">{hospital.address}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {presenceCount} live
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <BedDouble className="h-3.5 w-3.5" />
              {beds.length} beds
            </Badge>
            <Badge className="border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              {stats.available} avail
            </Badge>
            <Badge className="border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400">
              {stats.reserved} reserved
            </Badge>
            <Badge className="border border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-400">
              {stats.occupied} occupied
            </Badge>
            <Badge variant="outline">{occupancyPct}% full</Badge>
            {staffMode && (
              <Button
                size="sm"
                variant={emergencyOn ? "default" : "outline"}
                className={emergencyOn ? "bg-rose-600 hover:bg-rose-700" : ""}
                onClick={onToggleEmergency}
              >
                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                {emergencyOn ? "Clear emergency" : "Emergency mode"}
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            {staffMode ? (
              <>
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>
                  <strong className="text-foreground">Staff mode.</strong> Tap any bed to flip it
                  between available and occupied. User-reserved beds are protected.
                </span>
              </>
            ) : auth.user ? (
              <>
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>
                  <strong className="text-foreground">One reservation per account.</strong> Picking
                  another bed moves your reservation. Tap your bed again to release.
                </span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-primary" />
                <span>
                  <Link to="/auth" className="font-semibold text-foreground underline">
                    Sign in
                  </Link>{" "}
                  to reserve a bed. View-only mode.
                </span>
              </>
            )}
          </div>
          {myReservation && (
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">
                Your bed: #{myReservation.bed_number} · {myReservation.bed_type}
              </Badge>
              <Button size="sm" variant="ghost" onClick={releaseMine} className="h-7 gap-1">
                <X className="h-3.5 w-3.5" /> Release
              </Button>
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "beds" | "history")}>
          <TabsList>
            <TabsTrigger value="beds">
              <BedDouble className="mr-1.5 h-3.5 w-3.5" /> Beds
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-1.5 h-3.5 w-3.5" /> Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="beds" className="pt-4">
            {loading ? (
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12 md:grid-cols-16">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {grouped.map(({ type, beds: arr }) => (
                  <div key={type}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {type === "ICU" ? "Intensive Care" : type === "ER" ? "Emergency" : "General Ward"}
                      </h3>
                      <span className="text-xs text-muted-foreground">{arr.length} beds</span>
                    </div>
                    <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12 md:grid-cols-16">
                      {arr.map((b) => (
                        <BedCell
                          key={b.id}
                          bed={b}
                          mine={!!auth.user && b.reserved_by_user === auth.user.id}
                          onClick={() => onBedClick(b)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Reserved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Your reservation
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Occupied
              </span>
            </div>
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            <ActivityList events={events} />
          </TabsContent>
        </Tabs>
      </Card>
    </section>
  );
}

function ActivityList({ events }: { events: BedEvent[] }) {
  if (events.length === 0)
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {events.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div>
            <span className="font-medium">{actionLabel(e.action)}</span>
            {e.bed_number != null && (
              <span className="text-muted-foreground">
                {" "}
                · Bed #{e.bed_number} {e.bed_type ? `(${e.bed_type})` : ""}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{relativeTime(e.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function actionLabel(a: string): string {
  switch (a) {
    case "reserved": return "Bed reserved";
    case "released": return "Bed released";
    case "occupied": return "Marked occupied";
    case "available": return "Marked available";
    case "emergency_set": return "🚨 Emergency mode ON";
    case "emergency_clear": return "Emergency mode cleared";
    default: return a;
  }
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

function BedCell({
  bed,
  mine,
  onClick,
}: {
  bed: Bed;
  mine: boolean;
  onClick: () => void;
}) {
  const cls = mine
    ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/40"
    : bed.status === "available"
      ? "bg-emerald-500/15 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-900 dark:text-emerald-200"
      : bed.status === "reserved"
        ? "bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200 cursor-not-allowed"
        : "bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-200";
  return (
    <button
      onClick={onClick}
      title={`Bed #${bed.bed_number} · ${bed.bed_type} · ${STATUS_LABEL[bed.status]}`}
      className={`flex aspect-square items-center justify-center rounded-md border text-[10px] font-semibold transition-all hover:scale-[1.08] ${cls}`}
    >
      {bed.bed_number}
    </button>
  );
}
