/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  searchNearbyHospitals,
  geocodeAddress,
  estimateBeds,
  type NearbyHospital,
} from "@/lib/hospitals.functions";
import { useGoogleMaps } from "@/lib/use-google-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  BedDouble,
  Crosshair,
  Hospital as HospitalIcon,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";

const HOSPITAL_TYPE_LABELS: Record<string, string> = {
  hospital: "General Hospital",
  doctor: "Clinic",
  pharmacy: "Pharmacy",
  health: "Health",
  emergency_room: "Emergency Room",
  medical_lab: "Medical Lab",
  dental_clinic: "Dental",
  physiotherapist: "Physiotherapy",
};

function prettyTypes(types: string[]): string[] {
  const filtered = types.filter(
    (t) => !["point_of_interest", "establishment", "place_of_worship"].includes(t),
  );
  return filtered.slice(0, 3).map((t) => HOSPITAL_TYPE_LABELS[t] ?? t.replace(/_/g, " "));
}

interface Props {
  selectedId: string | null;
  onSelect: (h: NearbyHospital | null) => void;
}

export function HospitalFinder({ selectedId, onSelect }: Props) {
  const { ready: mapsReady, error: mapsError } = useGoogleMaps();
  const search = useServerFn(searchNearbyHospitals);
  const geocode = useServerFn(geocodeAddress);

  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [centerLabel, setCenterLabel] = useState<string>("");
  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [loading, setLoading] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const centerMarkerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!mapsReady || !mapEl.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(mapEl.current, {
      center: { lat: 20, lng: 0 },
      zoom: 2,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#f4f6f8" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#4b5563" }] },
        { featureType: "water", stylers: [{ color: "#c7e0f5" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "road", stylers: [{ color: "#ffffff" }] },
      ],
    });
  }, [mapsReady]);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = hospitals.map((h) => {
      const isSel = h.id === selectedId;
      const marker = new google.maps.Marker({
        position: { lat: h.lat, lng: h.lng },
        map: mapRef.current!,
        title: h.name,
        zIndex: isSel ? 999 : 1,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSel ? 11 : 8,
          fillColor: isSel ? "#0ea5e9" : "#ef4444",
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => onSelect(h));
      return marker;
    });
  }, [hospitals, selectedId, onSelect]);

  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.panTo(center);
    mapRef.current.setZoom(13);
    centerMarkerRef.current?.setMap(null);
    centerMarkerRef.current = new google.maps.Marker({
      position: center,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#10b981",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
    });
  }, [center]);

  async function runSearch(loc: { lat: number; lng: number }) {
    setLoading(true);
    setHospitals([]);
    onSelect(null);
    try {
      const result = await search({ data: { lat: loc.lat, lng: loc.lng, radiusMeters: 5000 } });
      setHospitals(result);
      if (result.length === 0) toast.info("No hospitals found within 5km — try a different area.");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load nearby hospitals");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const r = await geocode({ data: { address: query.trim() } });
      setCenter({ lat: r.lat, lng: r.lng });
      setCenterLabel(r.address);
      await runSearch({ lat: r.lat, lng: r.lng });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't find that location");
      setLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(loc);
        setCenterLabel("Your current location");
        await runSearch(loc);
      },
      (err) => {
        console.error(err);
        toast.error("Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pt-8">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Find hospitals near you</h2>
        <p className="text-sm text-muted-foreground">
          Search a city or use your location. Tap a hospital to view its real-time bed grid.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city, neighborhood, or address"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Searching…" : "Search"}
        </Button>
        <Button type="button" variant="outline" onClick={useMyLocation} disabled={loading}>
          <Crosshair className="mr-2 h-4 w-4" />
          Use my location
        </Button>
      </form>

      {centerLabel && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {centerLabel}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card className="overflow-hidden p-0">
          <div ref={mapEl} className="h-[420px] w-full bg-muted" />
          {mapsError && (
            <div className="border-t border-border p-3 text-sm text-destructive">
              Map unavailable: {mapsError}
            </div>
          )}
        </Card>

        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}
          {!loading && hospitals.length === 0 && (
            <Card className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              <div className="space-y-2">
                <HospitalIcon className="mx-auto h-8 w-8 opacity-40" />
                <p>Search a location to see nearby hospitals.</p>
              </div>
            </Card>
          )}
          {hospitals.map((h) => {
            const beds = estimateBeds(h.id);
            const isSel = h.id === selectedId;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onSelect(isSel ? null : h)}
                className={`text-left transition-colors ${isSel ? "" : ""}`}
              >
                <Card
                  className={`flex gap-3 p-3 transition-colors ${
                    isSel ? "border-primary bg-primary/5 ring-1 ring-primary/30" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate font-semibold">{h.name}</h3>
                      {h.rating != null && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {h.rating.toFixed(1)}
                          {h.userRatingCount ? ` (${h.userRatingCount})` : ""}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{h.address}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {prettyTypes(h.types).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                      <Badge className="ml-auto gap-1 border border-primary/30 bg-primary/10 text-[10px] text-primary">
                        <BedDouble className="h-3 w-3" />
                        {beds} max beds
                      </Badge>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
