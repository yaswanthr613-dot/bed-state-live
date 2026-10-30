// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The Google Maps connector exposes its browser-rendering key in the runtime as
// GOOGLE_MAPS_BROWSER_KEY / GOOGLE_MAPS_TRACKING_ID (no VITE_ prefix), while the app code
// reads the VITE_LOVABLE_CONNECTOR_* names. Map the former onto the latter at build time so
// the key is inlined on every environment (dev, preview, published) instead of depending on
// platform-specific env injection.
const mapsBrowserKey =
  process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ??
  process.env.GOOGLE_MAPS_BROWSER_KEY ??
  "";
const mapsTrackingId =
  process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID ??
  process.env.GOOGLE_MAPS_TRACKING_ID ??
  "";

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY": JSON.stringify(mapsBrowserKey),
      "import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID": JSON.stringify(mapsTrackingId),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
