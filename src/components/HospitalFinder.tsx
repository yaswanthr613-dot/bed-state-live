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
  ChevronRight,
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

export function prettyTypes(types: string[]): string[] {
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestRef = useRef(0);

  const searchFormRef = useRef<HTMLFormElement>(null);
  const retryActionRef = useRef<(() => void) | null>(null);
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
        { elementType: "geometry", stylers: [{ color: "#141c2b" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8fa3bf" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#141c2b" }] },
        { featureType: "water", stylers: [{ color: "#0b2239" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "road", stylers: [{ color: "#22304a" }] },
        { featureType: "road.arterial", stylers: [{ color: "#2b3d5e" }] },
        { featureType: "road.highway", stylers: [{ color: "#31476d" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
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
          fillColor: isSel ? "#67e8d2" : "#a78bfa",
          fillOpacity: 0.95,
          strokeColor: "#e2f5ff",
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
        fillColor: "#34d399",
        fillOpacity: 1,
        strokeColor: "#e2f5ff",
        strokeWeight: 3,
      },
    });
  }, [center]);

  async function runSearch(
    loc: { lat: number; lng: number },
    requestId = ++searchRequestRef.current,
  ) {
    setLoading(true);
    setHospitals([]);
    onSelect(null);
    setSearchError(null);
    try {
      const result = await search({ data: { lat: loc.lat, lng: loc.lng, radiusMeters: 5000 } });
      if (requestId !== searchRequestRef.current) return;
      setHospitals(result);
      if (result.length === 0) toast.info("No hospitals found within 5km — try a different area.");
    } catch (e) {
      console.error(e);
      if (requestId === searchRequestRef.current) {
        setSearchError("We couldn't load hospitals for this location. Try again.");
        toast.error("Couldn't load nearby hospitals");
      }
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const requestId = ++searchRequestRef.current;
    retryActionRef.current = () => searchFormRef.current?.requestSubmit();
    setLoading(true);
    setSearchError(null);
    onSelect(null);
    try {
      const r = await geocode({ data: { address: query.trim() } });
      if (requestId !== searchRequestRef.current) return;
      setCenter({ lat: r.lat, lng: r.lng });
      setCenterLabel(r.address);
      await runSearch({ lat: r.lat, lng: r.lng }, requestId);
    } catch (e) {
      console.error(e);
      if (requestId === searchRequestRef.current) {
        setSearchError("We couldn't find that location. Check the address and try again.");
        toast.error("Couldn't find that location");
      }
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't available in this browser");
      return;
    }
    const requestId = ++searchRequestRef.current;
    retryActionRef.current = useMyLocation;
    setLoading(true);
    setSearchError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (requestId !== searchRequestRef.current) return;
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(loc);
        setCenterLabel("Your current location");
        await runSearch(loc, requestId);
      },
      (err) => {
        console.error(err);
        if (requestId === searchRequestRef.current) {
          setLoading(false);
          setSearchError("Location access failed. Check your browser permissions and try again.");
          toast.error("Couldn't get your location");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <div className="mb-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary/90">
          Explore local care
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">Find hospitals near you</h2>
        <p className="text-sm text-muted-foreground">
          Search an area or use your location. Select a hospital to explore current bed
          availability.
        </p>
      </div>

      <div className="glass-strong mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
        <form
          ref={searchFormRef}
          onSubmit={handleSearch}
          className="flex flex-1 flex-wrap items-center gap-2"
        >
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city, neighborhood, or address"
              aria-label="Search a city, neighborhood, or address"
              className="h-11 rounded-xl border-border/70 bg-background/45 pl-9 focus-visible:ring-primary/50"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-11 rounded-xl px-5"
          >
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>
        <Button
          type="button"
          variant="outline"
          onClick={useMyLocation}
          disabled={loading}
          className="h-11 rounded-xl bg-foreground/[0.03]"
        >
          <Crosshair className="mr-2 h-4 w-4" />
          Use my location
        </Button>
      </div>

      {searchError && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
        >
          <span>{searchError}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => retryActionRef.current?.()}
          >
            Try again
          </Button>
        </div>
      )}

      {centerLabel && (
        <div
          className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <MapPin className="h-3.5 w-3.5" />
          {centerLabel}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="glass overflow-hidden rounded-3xl p-0">
          <div
            ref={mapEl}
            className="h-[360px] w-full bg-background sm:h-[440px]"
            aria-label="Map of nearby hospitals"
          />
          {mapsError && (
            <div className="border-t border-border p-3 text-sm text-destructive">
              Map unavailable: {mapsError}
            </div>
          )}
        </Card>

        <div className="flex min-h-[360px] flex-col sm:min-h-[440px]" aria-busy={loading}>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold">Nearby hospitals</h3>
            <Badge variant="outline" className="border-primary/20 bg-primary/[0.06] text-primary">
              {loading ? "Updating…" : `${hospitals.length} found`}
            </Badge>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
            {loading && (
              <div className="space-y-2.5" aria-label="Loading hospitals">
                {hospitals.length === 0 &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/40" />
                  ))}
              </div>
            )}
            {!loading && hospitals.length === 0 && (
              <Card className="glass flex min-h-64 flex-1 items-center justify-center rounded-2xl p-6 text-center text-sm text-muted-foreground">
                <div className="space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-400/20">
                    <HospitalIcon className="h-6 w-6 text-primary/80" />
                  </div>
                  <p>
                    {searchError
                      ? "Your last search didn't finish."
                      : "Search an area to discover nearby hospitals."}
                  </p>
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
                  aria-pressed={isSel}
                  aria-label={`${h.name}, ${beds} estimated beds${isSel ? ", selected" : ""}`}
                  className="group text-left transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.99]"
                >
                  <Card
                    className={`glass flex gap-3 rounded-2xl p-3.5 transition-all duration-200 ${
                      isSel
                        ? "glass-ring border-primary/40 bg-primary/10"
                        : "hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/30">
                      <HospitalIcon
                        className={`h-5 w-5 ${isSel ? "text-primary" : "text-foreground/70"}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
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
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                            isSel
                              ? "translate-x-0.5 text-primary"
                              : "text-muted-foreground/50 group-hover:text-muted-foreground"
                          }`}
                        />
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
