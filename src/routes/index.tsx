import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { HospitalFinder } from "@/components/HospitalFinder";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediSync — Hospital Resource Coordinator" },
      {
        name: "description",
        content:
          "Real-time hospital room coordination dashboard. Track ICU, ER, and Ward bay availability live across your team.",
      },
      { property: "og:title", content: "MediSync — Hospital Resource Coordinator" },
      {
        property: "og:description",
        content: "Live, color-coded hospital grid with instant cross-team sync.",
      },
    ],
  }),
  component: MediSync,
});

type Status = "available" | "reserved" | "occupied";
type RoomType = "ICU" | "ER" | "WARD";

interface Room {
  id: string;
  label: string;
  row_idx: number;
  col_idx: number;
  room_type: RoomType;
  status: Status;
}

const STATUS_CYCLE: Record<Status, Status> = {
  available: "reserved",
  reserved: "occupied",
  occupied: "available",
};

const STATUS_LABEL: Record<Status, string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
};

function MediSync() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectedUsers, setConnectedUsers] = useState(1);
  const [emergency, setEmergency] = useState(false);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("row_idx")
        .order("col_idx");
      if (cancelled) return;
      if (error) {
        toast.error("Failed to load rooms");
        console.error(error);
      } else {
        setRooms((data ?? []) as Room[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime room updates
  useEffect(() => {
    const channel = supabase
      .channel("rooms-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms" },
        (payload) => {
          const updated = payload.new as Room;
          setRooms((prev) =>
            prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Presence (live connected users)
  useEffect(() => {
    const userKey = crypto.randomUUID();
    const channel = supabase.channel("medisync-presence", {
      config: { presence: { key: userKey } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setConnectedUsers(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const grid = useMemo(() => {
    const rows: Room[][] = [];
    rooms.forEach((r) => {
      if (!rows[r.row_idx]) rows[r.row_idx] = [];
      rows[r.row_idx][r.col_idx] = r;
    });
    return rows;
  }, [rooms]);

  const stats = useMemo(() => {
    const s = { available: 0, reserved: 0, occupied: 0 };
    rooms.forEach((r) => s[r.status]++);
    return s;
  }, [rooms]);

  async function cycleRoom(room: Room) {
    const next = STATUS_CYCLE[room.status];
    // optimistic
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, status: next } : r)),
    );
    const { error } = await supabase
      .from("rooms")
      .update({ status: next })
      .eq("id", room.id);
    if (error) {
      toast.error(`Couldn't update ${room.label}`);
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, status: room.status } : r)),
      );
    }
  }

  async function triggerEmergency() {
    if (emergency) return;
    setEmergency(true);
    toast.warning("Emergency Mode: marking all rooms occupied");
    const { error } = await supabase
      .from("rooms")
      .update({ status: "occupied" })
      .neq("status", "occupied");
    if (error) toast.error("Emergency broadcast failed");
    setTimeout(() => setEmergency(false), 4000);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors />

      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">MediSync</h1>
              <p className="text-xs text-muted-foreground">
                Hospital Resource Coordinator
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {connectedUsers} live
            </Badge>
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              {stats.available} Available
            </Badge>
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              {stats.reserved} Reserved
            </Badge>
            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
              {stats.occupied} Occupied
            </Badge>
            <Button
              variant="destructive"
              size="sm"
              onClick={triggerEmergency}
              disabled={emergency}
              className="gap-1.5"
            >
              <AlertTriangle className="h-4 w-4" />
              {emergency ? "Broadcasting…" : "Emergency Mode"}
            </Button>
          </div>
        </div>
      </header>

      <HospitalFinder />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-2">
          <h2 className="text-2xl font-semibold tracking-tight">Live floor plan</h2>
          <p className="text-sm text-muted-foreground">
            Real-time bay statuses synced across every connected user. Tap a bay to cycle its
            status.
          </p>
        </div>
        <div className="mb-4 flex items-center justify-between pt-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Tap any bay to cycle status
          </h3>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Reserved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Occupied
            </span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {grid.map((row, ri) => (
              <div
                key={ri}
                className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8"
              >
                {row.map((room) => (
                  <RoomCell key={room.id} room={room} onClick={cycleRoom} />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function RoomCell({
  room,
  onClick,
}: {
  room: Room;
  onClick: (r: Room) => void;
}) {
  const styles: Record<Status, string> = {
    available:
      "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-900 dark:text-emerald-200",
    reserved:
      "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-900 dark:text-amber-200",
    occupied:
      "bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-900 dark:text-rose-200",
  };
  return (
    <button
      onClick={() => onClick(room)}
      className={`group relative flex aspect-square flex-col items-start justify-between rounded-xl border p-3 text-left transition-all duration-200 hover:scale-[1.03] hover:shadow-md ${styles[room.status]}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {room.room_type}
      </span>
      <span className="text-lg font-bold">{room.label}</span>
      <span className="text-[10px] opacity-80">{STATUS_LABEL[room.status]}</span>
    </button>
  );
}
