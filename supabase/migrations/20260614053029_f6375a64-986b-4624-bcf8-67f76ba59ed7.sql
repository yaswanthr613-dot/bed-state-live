
CREATE TYPE public.room_status AS ENUM ('available', 'reserved', 'occupied');
CREATE TYPE public.room_type AS ENUM ('ICU', 'ER', 'WARD');

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  row_idx INT NOT NULL,
  col_idx INT NOT NULL,
  room_type public.room_type NOT NULL,
  status public.room_status NOT NULL DEFAULT 'available',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(row_idx, col_idx)
);

GRANT SELECT, UPDATE ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can update rooms" ON public.rooms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_rooms_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER rooms_touch_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_rooms_updated_at();

ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

-- Seed 6 rows x 8 cols = 48 rooms
DO $$
DECLARE
  r INT; c INT;
  letters TEXT[] := ARRAY['A','B','C','D','E','F'];
  rtype public.room_type;
BEGIN
  FOR r IN 0..5 LOOP
    FOR c IN 0..7 LOOP
      rtype := CASE
        WHEN r < 2 THEN 'ICU'::public.room_type
        WHEN r < 4 THEN 'ER'::public.room_type
        ELSE 'WARD'::public.room_type
      END;
      INSERT INTO public.rooms (label, row_idx, col_idx, room_type)
      VALUES (letters[r+1] || (c+1)::text, r, c, rtype);
    END LOOP;
  END LOOP;
END $$;
