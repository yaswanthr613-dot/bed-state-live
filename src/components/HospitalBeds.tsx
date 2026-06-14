import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureHospitalBeds,
  reserveBed,
  releaseMyBed,
  estimateBeds,
  type Bed,
  type NearbyHospital,
} from "@/lib/hospitals.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Shield, X } from "lucide-react";
import { toast } from "sonner";

const DEVICE_ID_KEY = "medisync_device_id";

function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr-stub-device-id-xxx";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

const STATUS_LABEL: Record<Bed["status"], string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
};

const TYPE_ORDER: Record<Bed["bed_type"], number> = { ICU: 0, ER: 1, WARD: 2 };

export function HospitalBeds({ hospital }: { hospital: NearbyHospital }) {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string>("");
  const ensure = useServerFn(ensureHospitalBeds);
  const reserve = useServerFn(reserveBed);
  const release = useServerFn(releaseMyBed);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  // Load / seed beds for this hospital
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBeds([]);
    const totalBeds = estimateBeds(hospital.id); // realistic per-hospital max
    ensure({
      data: { placeId: hospital.id, hospitalName: hospital.name, totalBeds },
    })
      .then((rows) => {
        if (cancelled) return;
        setBeds(rows);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Couldn't load beds for this hospital");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hospital.id, hospital.name, ensure]);

  // Realtime updates scoped to this hospital
  useEffect(() => {
    const channel = supabase
      .channel(`beds:${hospital.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hospital_beds",
          filter: `place_id=eq.${hospital.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setBeds((prev) => [...prev, payload.new as Bed]);
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as Bed;
            setBeds((prev) => prev.map((b) => (b.id === next.id ? next : b)));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospital.id]);

  // Also watch global UPDATEs so we see our own reservation get released elsewhere
  useEffect(() => {
    if (!deviceId) return;
    const channel = supabase
      .channel(`mybed:${deviceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "hospital_beds" },
        (payload) => {
          const next = payload.new as Bed;
          if (next.place_id === hospital.id) return; // handled by other channel
          // Cross-hospital change touching my reservation isn't shown in current grid,
          // but we'll surface a toast if my reservation was the one released.
          const prev = payload.old as Bed | null;
          if (prev?.reserved_by === deviceId && next.reserved_by == null) {
            // released elsewhere; nothing to do here
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId, hospital.id]);

  const stats = useMemo(() => {
    const s = { available: 0, reserved: 0, occupied: 0, byType: {} as Record<string, number> };
    beds.forEach((b) => {
      s[b.status]++;
      s.byType[b.bed_type] = (s.byType[b.bed_type] ?? 0) + 1;
    });
    return s;
  }, [beds]);

  const myReservation = beds.find((b) => b.reserved_by === deviceId && b.status === "reserved");
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
      .map(([type, arr]) => ({
        type,
        beds: arr.sort((a, b) => a.bed_number - b.bed_number),
      }));
  }, [beds]);

  async function onBedClick(bed: Bed) {
    if (!deviceId) return;
    if (bed.status === "occupied") {
      toast.error("Bed is occupied");
      return;
    }
    if (bed.reserved_by === deviceId) {
      // tap own reservation again → release
      try {
        await release({ data: { deviceId } });
        toast.success("Reservation released");
      } catch (e) {
        console.error(e);
        toast.error("Couldn't release reservation");
      }
      return;
    }
    if (bed.status === "reserved") {
      toast.error("Reserved by another user");
      return;
    }
    try {
      const res = await reserve({ data: { bedId: bed.id, deviceId } });
      if (!res.ok) {
        toast.error("That bed was just taken");
        return;
      }
      toast.success(
        myReservation
          ? `Moved your reservation to bed ${bed.bed_number}`
          : `Bed ${bed.bed_number} reserved`,
      );
    } catch (e) {
      console.error(e);
      toast.error("Reservation failed");
    }
  }

  async function releaseMine() {
    try {
      await release({ data: { deviceId } });
      toast.success("Reservation released");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't release reservation");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pb-12 pt-8">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{hospital.name}</h2>
            <p className="text-xs text-muted-foreground">{hospital.address}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <BedDouble className="h-3.5 w-3.5" />
              {beds.length} total beds
            </Badge>
            <Badge className="border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              {stats.available} available
            </Badge>
            <Badge className="border border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400">
              {stats.reserved} reserved
            </Badge>
            <Badge className="border border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-400">
              {stats.occupied} occupied
            </Badge>
            <Badge variant="outline">{occupancyPct}% occupancy</Badge>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span>
              <strong className="text-foreground">One reservation per device.</strong>{" "}
              Picking another bed will move your reservation. Tap your reservation again to
              release it.
            </span>
          </div>
          {myReservation ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">
                Your bed: #{myReservation.bed_number} · {myReservation.bed_type} ·{" "}
                {myReservation.hospital_name === hospital.name
                  ? "here"
                  : myReservation.hospital_name}
              </Badge>
              <Button size="sm" variant="ghost" onClick={releaseMine} className="h-7 gap-1">
                <X className="h-3.5 w-3.5" /> Release
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground">You have no active reservation</span>
          )}
        </div>

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
                    {type === "ICU"
                      ? "Intensive Care"
                      : type === "ER"
                        ? "Emergency"
                        : "General Ward"}
                  </h3>
                  <span className="text-xs text-muted-foreground">{arr.length} beds</span>
                </div>
                <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12 md:grid-cols-16">
                  {arr.map((b) => (
                    <BedCell
                      key={b.id}
                      bed={b}
                      mine={b.reserved_by === deviceId}
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
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Available — tap to reserve
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
      </Card>
    </section>
  );
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
        : "bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-200 cursor-not-allowed";
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
