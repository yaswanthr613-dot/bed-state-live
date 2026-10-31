/// <reference types="google.maps" />
import { useEffect, useState } from "react";

const SCRIPT_ID = "google-maps-js";
let loadPromise: Promise<typeof google> | null = null;

declare global {
  interface Window {
    __initGoogleMaps?: () => void;
    google: typeof google;
  }
}

function loadGoogleMaps(): Promise<typeof google> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window not available"));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) {
      reject(new Error("Missing Google Maps browser key"));
      return;
    }
    window.__initGoogleMaps = () => resolve(window.google);
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) return;
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initGoogleMaps${channel ? `&channel=${channel}` : ""}`;
    s.onerror = () => {
      // Allow a later attempt to re-inject the script instead of being stuck
      // with a permanently rejected promise after a transient network failure.
      loadPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(s);
  });
  return loadPromise;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState<boolean>(
    typeof window !== "undefined" && !!window.google?.maps,
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = (retriesLeft: number) => {
      loadGoogleMaps()
        .then(() => {
          if (!cancelled) setReady(true);
        })
        .catch((e) => {
          if (cancelled) return;
          if (retriesLeft > 0) {
            timer = setTimeout(() => attempt(retriesLeft - 1), 3000);
          } else {
            setError(e.message ?? "Failed to load map");
          }
        });
    };
    attempt(2);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return { ready, error };
}
