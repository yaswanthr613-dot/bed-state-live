
-- Remove old demo table (replaced by hospital_beds)
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TYPE IF EXISTS public.room_status CASCADE;
DROP TYPE IF EXISTS public.room_type CASCADE;

CREATE TYPE public.bed_status AS ENUM ('available', 'reserved', 'occupied');
CREATE TYPE public.bed_type AS ENUM ('ICU', 'ER', 'WARD');

CREATE TABLE public.hospital_beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL,
  hospital_name TEXT NOT NULL,
  bed_number INT NOT NULL,
  bed_type public.bed_type NOT NULL,
  status public.bed_status NOT NULL DEFAULT 'available',
  reserved_by TEXT,
  reserved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (place_id, bed_number)
);

CREATE INDEX hospital_beds_place_idx ON public.hospital_beds (place_id);

-- One active reservation per device, across the whole system.
CREATE UNIQUE INDEX hospital_beds_one_reservation_per_device
  ON public.hospital_beds (reserved_by)
  WHERE status = 'reserved' AND reserved_by IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.hospital_beds TO anon, authenticated;
GRANT ALL ON public.hospital_beds TO service_role;

ALTER TABLE public.hospital_beds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view beds"
  ON public.hospital_beds FOR SELECT TO anon, authenticated USING (true);

-- Inserts are server-driven (initial seed for a hospital); allow open insert.
CREATE POLICY "Anyone can seed beds"
  ON public.hospital_beds FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'available' OR status = 'occupied');

-- Direct updates restricted: only flipping availability or marking occupied is allowed
-- from the client. Reservations must go through reserve_bed() to enforce the 1-per-device rule.
CREATE POLICY "Anyone can mark occupancy"
  ON public.hospital_beds FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (status IN ('available', 'occupied') AND reserved_by IS NULL);

CREATE OR REPLACE FUNCTION public.touch_beds_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER hospital_beds_touch_updated_at BEFORE UPDATE ON public.hospital_beds
  FOR EACH ROW EXECUTE FUNCTION public.touch_beds_updated_at();

-- Atomic reservation: releases the device's prior reservation (anywhere) and
-- reserves the requested bed only if it's currently available.
CREATE OR REPLACE FUNCTION public.reserve_bed(_bed_id UUID, _device_id TEXT)
RETURNS public.hospital_beds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.hospital_beds;
BEGIN
  IF _device_id IS NULL OR length(_device_id) < 8 THEN
    RAISE EXCEPTION 'invalid_device_id';
  END IF;

  -- Release any existing reservation by this device
  UPDATE public.hospital_beds
     SET status = 'available', reserved_by = NULL, reserved_at = NULL
   WHERE reserved_by = _device_id AND status = 'reserved';

  -- Try to reserve the requested bed
  UPDATE public.hospital_beds
     SET status = 'reserved', reserved_by = _device_id, reserved_at = now()
   WHERE id = _bed_id AND status = 'available'
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'bed_unavailable';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_bed(UUID, TEXT) TO anon, authenticated;

-- Release the device's current reservation, if any.
CREATE OR REPLACE FUNCTION public.release_my_bed(_device_id TEXT)
RETURNS SETOF public.hospital_beds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.hospital_beds
     SET status = 'available', reserved_by = NULL, reserved_at = NULL
   WHERE reserved_by = _device_id AND status = 'reserved'
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_my_bed(TEXT) TO anon, authenticated;

ALTER TABLE public.hospital_beds REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_beds;
