import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
