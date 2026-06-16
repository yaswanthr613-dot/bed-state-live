
-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are visible to authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name',
             NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  -- Default role = patient
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient'::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- =========================================
-- ROLES
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'patient');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger to seed profile+role on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Admin manage policy on user_roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- HOSPITAL_BEDS: add user-keyed reservation
-- =========================================
ALTER TABLE public.hospital_beds
  ADD COLUMN reserved_by_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN occupied_reason TEXT;

CREATE UNIQUE INDEX hospital_beds_one_user_reservation
  ON public.hospital_beds (reserved_by_user)
  WHERE status = 'reserved' AND reserved_by_user IS NOT NULL;

-- Tighten policies (drop old loose ones)
DROP POLICY IF EXISTS "Anyone can mark occupancy" ON public.hospital_beds;

-- Patients (any signed-in user) can reserve/release via RPC only.
-- Staff/admin can also flip occupied/available directly.
CREATE POLICY "Staff/admin can update beds"
  ON public.hospital_beds FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- =========================================
-- HOSPITAL_STATE (emergency mode)
-- =========================================
CREATE TABLE public.hospital_state (
  place_id TEXT PRIMARY KEY,
  hospital_name TEXT NOT NULL,
  emergency_mode BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hospital_state TO anon, authenticated;
GRANT INSERT, UPDATE ON public.hospital_state TO authenticated;
GRANT ALL ON public.hospital_state TO service_role;

ALTER TABLE public.hospital_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read hospital state"
  ON public.hospital_state FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff/admin can change hospital state"
  ON public.hospital_state FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff/admin can update hospital state"
  ON public.hospital_state FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- =========================================
-- BED_EVENTS (audit log)
-- =========================================
CREATE TYPE public.bed_action AS ENUM (
  'reserved', 'released', 'occupied', 'available', 'emergency_set', 'emergency_clear'
);

CREATE TABLE public.bed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID REFERENCES public.hospital_beds(id) ON DELETE SET NULL,
  place_id TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  bed_number INTEGER,
  bed_type TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_display TEXT,
  action public.bed_action NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bed_events_place_idx ON public.bed_events(place_id, created_at DESC);
CREATE INDEX bed_events_actor_idx ON public.bed_events(actor_user_id, created_at DESC);

GRANT SELECT ON public.bed_events TO anon, authenticated;
GRANT INSERT ON public.bed_events TO authenticated;
GRANT ALL ON public.bed_events TO service_role;

ALTER TABLE public.bed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bed events"
  ON public.bed_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert their own events"
  ON public.bed_events FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() OR actor_user_id IS NULL);

-- =========================================
-- RPC: reserve / release as logged-in user
-- =========================================
CREATE OR REPLACE FUNCTION public.reserve_bed_for_user(_bed_id UUID)
RETURNS public.hospital_beds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.hospital_beds;
  uid UUID := auth.uid();
  prev RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Release any existing reservation by this user, capturing it for the audit log
  FOR prev IN
    UPDATE public.hospital_beds
       SET status = 'available', reserved_by_user = NULL, reserved_by = NULL, reserved_at = NULL
     WHERE reserved_by_user = uid AND status = 'reserved'
    RETURNING *
  LOOP
    INSERT INTO public.bed_events(bed_id, place_id, hospital_name, bed_number, bed_type, actor_user_id, action)
    VALUES (prev.id, prev.place_id, prev.hospital_name, prev.bed_number, prev.bed_type::text, uid, 'released');
  END LOOP;

  UPDATE public.hospital_beds
     SET status = 'reserved', reserved_by_user = uid, reserved_at = now()
   WHERE id = _bed_id AND status = 'available'
  RETURNING * INTO result;

  IF result.id IS NULL THEN RAISE EXCEPTION 'bed_unavailable'; END IF;

  INSERT INTO public.bed_events(bed_id, place_id, hospital_name, bed_number, bed_type, actor_user_id, action)
  VALUES (result.id, result.place_id, result.hospital_name, result.bed_number, result.bed_type::text, uid, 'reserved');

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_my_bed_user()
RETURNS SETOF public.hospital_beds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  r RECORD;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  FOR r IN
    UPDATE public.hospital_beds
       SET status = 'available', reserved_by_user = NULL, reserved_by = NULL, reserved_at = NULL
     WHERE reserved_by_user = uid AND status = 'reserved'
    RETURNING *
  LOOP
    INSERT INTO public.bed_events(bed_id, place_id, hospital_name, bed_number, bed_type, actor_user_id, action)
    VALUES (r.id, r.place_id, r.hospital_name, r.bed_number, r.bed_type::text, uid, 'released');
    RETURN NEXT r;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_bed_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_my_bed_user() TO authenticated;

-- =========================================
-- RPC: set bed occupancy (staff/admin)
-- =========================================
CREATE OR REPLACE FUNCTION public.set_bed_status(_bed_id UUID, _status public.bed_status)
RETURNS public.hospital_beds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.hospital_beds;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('available'::public.bed_status, 'occupied'::public.bed_status) THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE public.hospital_beds
     SET status = _status,
         reserved_by_user = NULL,
         reserved_by = NULL,
         reserved_at = NULL
   WHERE id = _bed_id
  RETURNING * INTO result;

  IF result.id IS NULL THEN RAISE EXCEPTION 'bed_not_found'; END IF;

  INSERT INTO public.bed_events(bed_id, place_id, hospital_name, bed_number, bed_type, actor_user_id, action)
  VALUES (result.id, result.place_id, result.hospital_name, result.bed_number, result.bed_type::text, uid,
          CASE WHEN _status::text = 'occupied' THEN 'occupied'::public.bed_action ELSE 'available'::public.bed_action END);

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_bed_status(UUID, public.bed_status) TO authenticated;

-- =========================================
-- RPC: toggle emergency mode (staff/admin)
-- =========================================
CREATE OR REPLACE FUNCTION public.toggle_emergency_mode(_place_id TEXT, _hospital_name TEXT, _on BOOLEAN)
RETURNS public.hospital_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.hospital_state;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'staff')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.hospital_state(place_id, hospital_name, emergency_mode, updated_by, updated_at)
  VALUES (_place_id, _hospital_name, _on, uid, now())
  ON CONFLICT (place_id) DO UPDATE
    SET emergency_mode = EXCLUDED.emergency_mode,
        updated_by = EXCLUDED.updated_by,
        updated_at = now(),
        hospital_name = EXCLUDED.hospital_name
  RETURNING * INTO result;

  IF _on THEN
    -- Flag all currently-available WARD beds as occupied (emergency_reason marker)
    UPDATE public.hospital_beds
       SET status = 'occupied', occupied_reason = 'emergency'
     WHERE place_id = _place_id
       AND status = 'available';
  ELSE
    -- Restore beds that were flipped by emergency mode
    UPDATE public.hospital_beds
       SET status = 'available', occupied_reason = NULL
     WHERE place_id = _place_id
       AND status = 'occupied'
       AND occupied_reason = 'emergency';
  END IF;

  INSERT INTO public.bed_events(bed_id, place_id, hospital_name, actor_user_id, action)
  VALUES (NULL, _place_id, _hospital_name, uid,
          CASE WHEN _on THEN 'emergency_set'::public.bed_action ELSE 'emergency_clear'::public.bed_action END);

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_emergency_mode(TEXT, TEXT, BOOLEAN) TO authenticated;

-- =========================================
-- Realtime publication
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bed_events;

-- profile touch trigger
CREATE OR REPLACE FUNCTION public.touch_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_profiles_updated_at();
