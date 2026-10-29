# Full app deployment

GitHub Pages serves static files and cannot run MediSync's TanStack Start server
functions. The interactive app must be deployed to Cloudflare Workers; the
GitHub Pages address can then redirect to the Worker URL.

## 1. Configure GitHub Actions

In the repository, open **Settings → Secrets and variables → Actions**.

Add these repository **variables**:

| Name                                             | Value                              |
| ------------------------------------------------ | ---------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`                          | Cloudflare account ID              |
| `VITE_SUPABASE_URL`                              | Supabase project URL               |
| `VITE_SUPABASE_PUBLISHABLE_KEY`                  | Supabase publishable key           |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | Browser-restricted Google Maps key |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` | Optional Maps tracking ID          |

Add this repository **secret**:

| Name                   | Value                                                  |
| ---------------------- | ------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with permission to deploy Workers |

The browser Maps key and Supabase publishable key are public client configuration
and will be included in the frontend bundle. Restrict the Maps key by website
referrer and allowed APIs; never put service-role keys or other server secrets in
`VITE_*` variables.

The deploy workflow runs on pushes to `main` and can be started manually from
**Actions → Deploy MediSync → Run workflow**. It skips deployment with a warning
until the required GitHub variables and Cloudflare token are configured.

## 2. Configure Worker runtime variables and secrets

After the first successful deployment, open the Worker in the Cloudflare dashboard
and add the following under **Settings → Variables and Secrets**:

| Name                       | Type     | Purpose                              |
| -------------------------- | -------- | ------------------------------------ |
| `SUPABASE_URL`             | Variable | Server-side Supabase project URL     |
| `SUPABASE_PUBLISHABLE_KEY` | Variable | Server-side Supabase publishable key |
| `LOVABLE_API_KEY`          | Secret   | Lovable Maps connector authorization |
| `GOOGLE_MAPS_API_KEY`      | Secret   | Maps connector API key               |

The active app uses authenticated, user-scoped reservation functions. The
`SUPABASE_SERVICE_ROLE_KEY` is not required for that flow; only configure it if
the legacy device-based reservation functions are deliberately enabled. Keep it
server-only and never expose it to the browser.

The Google Maps connector credentials are not present in the local environment.
Obtain them from the corresponding Lovable/Google Cloud project before expecting
hospital search, geocoding, or details to work.

After the Worker URL is known, add it to the Supabase Auth redirect URL allowlist
and to the browser Maps key's allowed HTTP referrers. Otherwise sign-in callbacks
or map loading may be rejected by those providers.

## 3. Point GitHub Pages to the Worker

When the Worker deployment succeeds, copy its `workers.dev` URL from the
deployment output. Update the Pages landing page in `index.md` to redirect to
that URL, then push the change. Do not remove the static-hosting notice until the
Worker is deployed and its runtime variables are configured.

## Local deployment

With Wrangler authentication and the same build-time configuration available:

```sh
npm run build
npx wrangler deploy --config .output/server/wrangler.json
```
