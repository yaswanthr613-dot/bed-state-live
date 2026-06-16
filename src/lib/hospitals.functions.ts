import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function authHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !mapsKey) {
    throw new Error("Missing Google Maps connector credentials");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
  };
}

export interface NearbyHospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  rating?: number;
  userRatingCount?: number;
}

// Deterministic synthetic bed-capacity estimate. Google does not return bed counts,
// so we derive a stable number from the place id so the UI is consistent across reloads.
export function estimateBeds(placeId: string): number {
  let hash = 0;
  for (let i = 0; i < placeId.length; i++) {
    hash = (hash * 31 + placeId.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(hash);
  return 40 + (abs % 360); // 40 - 399 beds
}

export const searchNearbyHospitals = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusMeters: z.number().min(500).max(50000).default(5000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<NearbyHospital[]> => {
    const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchNearby`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        includedTypes: ["hospital"],
        maxResultCount: 20,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: data.lat, longitude: data.lng },
            radius: data.radiusMeters,
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Places API error ${res.status}: ${text}`);
    }
    const json = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        types?: string[];
        rating?: number;
        userRatingCount?: number;
      }>;
    };

    return (json.places ?? []).map((p) => ({
      id: p.id,
      name: p.displayName?.text ?? "Unknown hospital",
      address: p.formattedAddress ?? "",
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      types: p.types ?? [],
      rating: p.rating,
      userRatingCount: p.userRatingCount,
    }));
  });

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ address: z.string().min(2).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error(`Geocode error ${res.status}`);
    const json = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (json.status !== "OK" || !json.results.length) {
      throw new Error(`No results for "${data.address}"`);
    }
    const r = json.results[0];
    return {
      address: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    };
  });

// ---------- Hospital beds ----------

export interface Bed {
  id: string;
  place_id: string;
  hospital_name: string;
  bed_number: number;
  bed_type: "ICU" | "ER" | "WARD";
  status: "available" | "reserved" | "occupied";
  reserved_by: string | null;
  reserved_by_user: string | null;
  occupied_reason: string | null;
}

function hashStr(s: string, seed = 0): number {
  let h = seed;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function bedSeed(placeId: string, bedNum: number, totalBeds: number) {
  const h1 = hashStr(placeId + ":t:" + bedNum);
  const h2 = hashStr(placeId + ":s:" + bedNum);
  // Type distribution: ~10% ICU, ~20% ER, ~70% Ward.
  // Place ICU first, then ER, then Ward so the grid reads naturally.
  const icuCount = Math.max(1, Math.round(totalBeds * 0.1));
  const erCount = Math.max(1, Math.round(totalBeds * 0.2));
  let type: Bed["bed_type"];
  if (bedNum <= icuCount) type = "ICU";
  else if (bedNum <= icuCount + erCount) type = "ER";
  else type = "WARD";
  // Realistic occupancy: ICU ~85% occupied, ER ~70%, Ward ~60%.
  const occThreshold = type === "ICU" ? 85 : type === "ER" ? 70 : 60;
  const status: Bed["status"] = h2 % 100 < occThreshold ? "occupied" : "available";
  return { type, status, _h: h1 };
}

export const ensureHospitalBeds = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        placeId: z.string().min(1),
        hospitalName: z.string().min(1),
        totalBeds: z.number().int().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Bed[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: selErr } = await supabaseAdmin
      .from("hospital_beds")
      .select("*")
      .eq("place_id", data.placeId)
      .order("bed_number");
    if (selErr) throw new Error(selErr.message);

    if ((existing?.length ?? 0) >= data.totalBeds) {
      return existing as Bed[];
    }

    const have = new Set((existing ?? []).map((b) => b.bed_number));
    const toInsert: Array<{
      place_id: string;
      hospital_name: string;
      bed_number: number;
      bed_type: Bed["bed_type"];
      status: Bed["status"];
    }> = [];
    for (let i = 1; i <= data.totalBeds; i++) {
      if (have.has(i)) continue;
      const seed = bedSeed(data.placeId, i, data.totalBeds);
      toInsert.push({
        place_id: data.placeId,
        hospital_name: data.hospitalName,
        bed_number: i,
        bed_type: seed.type,
        status: seed.status,
      });
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("hospital_beds").insert(toInsert);
      if (insErr) throw new Error(insErr.message);
    }

    const { data: full, error: finalErr } = await supabaseAdmin
      .from("hospital_beds")
      .select("*")
      .eq("place_id", data.placeId)
      .order("bed_number");
    if (finalErr) throw new Error(finalErr.message);
    return (full ?? []) as Bed[];
  });

export const reserveBed = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ bedId: z.string().uuid(), deviceId: z.string().min(8).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.rpc("reserve_bed", {
      _bed_id: data.bedId,
      _device_id: data.deviceId,
    });
    if (error) {
      if (error.message.includes("bed_unavailable")) {
        return { ok: false as const, reason: "unavailable" as const };
      }
      throw new Error(error.message);
    }
    return { ok: true as const, bed: row as Bed };
  });

export const releaseMyBed = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ deviceId: z.string().min(8).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("release_my_bed", { _device_id: data.deviceId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Authenticated server fns (Phase 1 backend) ----------

export const reserveBedAsUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bedId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("reserve_bed_for_user", {
      _bed_id: data.bedId,
    });
    if (error) {
      if (error.message.includes("bed_unavailable")) return { ok: false as const, reason: "unavailable" as const };
      if (error.message.includes("not_authenticated")) return { ok: false as const, reason: "auth" as const };
      throw new Error(error.message);
    }
    return { ok: true as const, bed: row as unknown as Bed };
  });

export const releaseMyBedAsUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("release_my_bed_user");
    if (error && !error.message.includes("not_authenticated")) throw new Error(error.message);
    return { ok: true };
  });

export const setBedOccupancy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      bedId: z.string().uuid(),
      status: z.enum(["available", "occupied"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("set_bed_status", {
      _bed_id: data.bedId,
      _status: data.status,
    });
    if (error) {
      if (error.message.includes("forbidden")) return { ok: false as const, reason: "forbidden" as const };
      throw new Error(error.message);
    }
    return { ok: true as const, bed: row as unknown as Bed };
  });

export const toggleEmergencyMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      placeId: z.string().min(1),
      hospitalName: z.string().min(1),
      on: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("toggle_emergency_mode", {
      _place_id: data.placeId,
      _hospital_name: data.hospitalName,
      _on: data.on,
    });
    if (error) {
      if (error.message.includes("forbidden")) return { ok: false as const, reason: "forbidden" as const };
      throw new Error(error.message);
    }
    return { ok: true as const, state: row };
  });

export interface BedEvent {
  id: string;
  bed_id: string | null;
  place_id: string;
  hospital_name: string;
  bed_number: number | null;
  bed_type: string | null;
  actor_user_id: string | null;
  action: string;
  created_at: string;
}

export const listBedEvents = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      placeId: z.string().optional(),
      actorUserId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<BedEvent[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("bed_events").select("*").order("created_at", { ascending: false }).limit(data.limit);
    if (data.placeId) q = q.eq("place_id", data.placeId);
    if (data.actorUserId) q = q.eq("actor_user_id", data.actorUserId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as BedEvent[];
  });

export const getHospitalState = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ placeId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("hospital_state")
      .select("*")
      .eq("place_id", data.placeId)
      .maybeSingle();
    return row;
  });
