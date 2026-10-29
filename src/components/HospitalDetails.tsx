import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getHospitalDetails,
  type HospitalDetails as HospitalDetailsData,
  type NearbyHospital,
} from "@/lib/hospitals.functions";
import { prettyTypes } from "@/components/HospitalFinder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star,
  MapPin,
  Phone,
  Globe,
  Clock,
  Navigation,
  Hospital as HospitalIcon,
  ChevronDown,
  ChevronUp,
  Camera,
} from "lucide-react";
import { toast } from "sonner";

const DAY_INDEX: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function RatingStars({ rating }: { rating?: number }) {
  if (rating == null) return null;
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted-foreground/20 text-muted-foreground/20"
          }`}
        />
      ))}
    </span>
  );
}

export function HospitalDetails({ hospital }: { hospital: NearbyHospital }) {
  const fetchDetails = useServerFn(getHospitalDetails);
  const [details, setDetails] = useState<HospitalDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetails(null);
    setPhotoFailed(false);
    setShowAllHours(false);
    fetchDetails({ data: { placeId: hospital.id } })
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) toast.error("Couldn't load hospital details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hospital.id, fetchDetails]);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hospital.id]);

  const today = DAY_INDEX[new Date().getDay()];
  const todayLine = details?.hours?.find((h) => h.startsWith(`${today}:`));
  const directionsUrl =
    details?.mapsUri ??
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      details?.address || hospital.address,
    )}`;

  return (
    <section ref={ref} className="mx-auto max-w-7xl scroll-mt-24 px-6 pt-6">
      <div className="glass overflow-hidden rounded-3xl shadow-xl shadow-black/30">
        {loading ? (
          <div className="grid gap-0 md:grid-cols-[minmax(0,420px)_1fr]">
            <div className="aspect-[4/3] animate-pulse bg-muted/40 md:aspect-auto" />
            <div className="space-y-3 p-6">
              <div className="h-7 w-2/3 animate-pulse rounded-lg bg-muted/40" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted/40" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
              <div className="h-4 w-2/5 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-[minmax(0,420px)_1fr]">
            {/* Photo / hero */}
            <div className="relative min-h-[240px] overflow-hidden md:min-h-[300px]">
              {details?.photoUri && !photoFailed ? (
                <img
                  src={details.photoUri}
                  alt={details.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  onError={() => setPhotoFailed(true)}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/25 via-card to-accent/25">
                  <HospitalIcon className="h-14 w-14 text-primary/70" />
                  <span className="text-xs text-muted-foreground">No photo available</span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              {details?.photoAttribution && (
                <span className="absolute bottom-2 right-3 flex items-center gap-1 text-[10px] text-white/70">
                  <Camera className="h-3 w-3" /> Photo: {details.photoAttribution}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="p-6 md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold tracking-tight">{details?.name ?? hospital.name}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                    <RatingStars rating={details?.rating} />
                    {details?.rating != null && (
                      <span className="font-medium">
                        {details.rating.toFixed(1)}
                        {details.userRatingCount ? (
                          <span className="text-muted-foreground"> ({details.userRatingCount})</span>
                        ) : null}
                      </span>
                    )}
                    {details?.openNow === true && (
                      <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                        Open now
                      </Badge>
                    )}
                    {details?.openNow === false && (
                      <Badge className="border border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-300">
                        Closed
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {prettyTypes(details?.types ?? hospital.types).map((t) => (
                    <Badge key={t} variant="secondary" className="glass text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              {details?.editorial && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{details.editorial}</p>
              )}

              <div className="mt-5 space-y-2.5 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{details?.address || hospital.address}</span>
                </div>
                {details?.phone && (
                  <a href={`tel:${details.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 transition-colors hover:text-foreground">
                    <Phone className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground underline-offset-4 hover:underline">{details.phone}</span>
                  </a>
                )}
                {details?.website && (
                  <a href={details.website} target="_blank" rel="noreferrer" className="flex items-center gap-3 transition-colors hover:text-foreground">
                    <Globe className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-muted-foreground underline-offset-4 hover:underline">
                      {details.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </span>
                  </a>
                )}
                {details?.hours && (
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowAllHours((v) => !v)}
                        className="text-left text-muted-foreground underline-offset-4 hover:underline"
                      >
                        <span className={todayLine?.includes("Closed") ? "text-rose-400" : "text-emerald-400"}>
                          {todayLine?.split(": ").slice(1).join(": ") ?? "Hours available"}
                        </span>{" "}
                        <span className="text-xs">· today ({today})</span>
                        {showAllHours ? <ChevronUp className="ml-1 inline h-3.5 w-3.5" /> : <ChevronDown className="ml-1 inline h-3.5 w-3.5" />}
                      </button>
                      {showAllHours && (
                        <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                          {details.hours.map((h) => (
                            <li key={h} className={h.startsWith(`${today}:`) ? "font-medium text-foreground" : ""}>
                              {h}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild className="gap-2 rounded-full">
                  <a href={directionsUrl} target="_blank" rel="noreferrer">
                    <Navigation className="h-4 w-4" /> Directions
                  </a>
                </Button>
                {details?.phone && (
                  <Button asChild variant="outline" className="glass gap-2 rounded-full">
                    <a href={`tel:${details.phone.replace(/\s/g, "")}`}>
                      <Phone className="h-4 w-4" /> Call
                    </a>
                  </Button>
                )}
                {details?.website && (
                  <Button asChild variant="outline" className="glass gap-2 rounded-full">
                    <a href={details.website} target="_blank" rel="noreferrer">
                      <Globe className="h-4 w-4" /> Website
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
