# MediSync — Full Backend Plan

You picked a lot. To keep it shippable I'm grouping it into 3 phases. I'll build Phase 1 now, then check in before Phase 2/3. The "PostgreSQL + Redis + AWS/Render" item is out of scope — your backend already **is** managed Postgres on Lovable Cloud, with realtime built in. I'll explain that at the end instead of rewriting infra.

---

## Phase 1 — Core backend (this turn)

**Auth**
- Email/password + Google sign-in via the Lovable auth broker
- `/auth` page (sign-in / sign-up tabs), managed `_authenticated` gate
- `profiles` table (display_name, created_at) auto-populated on signup via trigger

**Roles (RBAC, secure pattern)**
- `app_role` enum: `admin`, `staff`, `patient` (default `patient`)
- `user_roles` table + `has_role()` security-definer function
- Admins/staff can manage beds for any hospital; patients can reserve 1 bed
- Reservation now keyed to `auth.uid()` (replaces device-id hack), still enforced 1-per-user via partial unique index

**Reservation history / audit log**
- `bed_events` table: bed_id, place_id, hospital_name, bed_type, actor_user_id, action (`reserved`/`released`/`occupied`/`available`/`emergency_set`/`emergency_clear`), created_at
- Trigger on `hospital_beds` writes an event row on every status change
- "History" tab on hospital view shows last 50 events; admins see global feed

**Live presence + Emergency Mode**
- Supabase Realtime presence channel `hospital:{place_id}` → header pill shows live viewer count per hospital
- `emergency_mode` boolean column on a new `hospital_state` table (one row per place_id), toggle exposed to admin/staff only
- When ON, all ward beds for that hospital flip to `occupied` and UI shows red banner; toggling OFF restores availability for previously-available beds (event-log driven)

---

## Phase 2 — Intelligence (next turn, after you approve Phase 1)

**AI doctor assignment** — Lovable AI (`google/gemini-3-flash-preview`) server function takes `{bed_type, symptoms, urgency}` and returns recommended specialty + on-call doctor from a `doctors` table (seeded per hospital). Stored on reservation.

**Hospital analytics dashboard** — `/admin/analytics` route (admin only): occupancy % per hospital, bed-type breakdown, reservations/hour sparkline, avg time-to-release. Built from `bed_events` with SQL aggregations.

---

## Phase 3 — Mobile + infra (discuss after Phase 2)

- **Ambulance mobile view**: responsive `/ambulance` route optimized for phone — big buttons, GPS auto-fill, one-tap reserve. Same backend, different UI shell. (A real native app is a separate project.)
- **Production infra**: your app already runs on managed Postgres with realtime, edge-deployed server functions, and a global CDN — equivalent to "Postgres + Redis + deploy on Render" with zero ops. I'll write up the architecture so you can put it in your demo/README instead of rebuilding it on AWS.

---

## Technical details (Phase 1)

```text
DB:
  profiles(id PK→auth.users, display_name)
  app_role ENUM(admin, staff, patient)
  user_roles(user_id, role)  + has_role(uid, role) SECURITY DEFINER
  bed_events(id, bed_id, place_id, hospital_name, bed_type, actor_user_id, action, created_at)
  hospital_state(place_id PK, emergency_mode bool, updated_by, updated_at)
  hospital_beds: add reserved_by_user uuid; keep reserved_by (device) for back-compat, drop in P2

Server fns (createServerFn + requireSupabaseAuth):
  reserveBed, releaseMyBed, setBedOccupancy, toggleEmergencyMode, listBedEvents

Realtime:
  postgres_changes on hospital_beds, bed_events, hospital_state
  presence channel per hospital for live viewer count

Routes:
  /auth                       (public)
  /                           (public — hospital search + live floor)
  /_authenticated/history     (user's own reservation history)
  /_authenticated/admin       (admin/staff only, gated by has_role)
```

Reply **"go"** to build Phase 1, or tell me which pieces to cut/reorder.