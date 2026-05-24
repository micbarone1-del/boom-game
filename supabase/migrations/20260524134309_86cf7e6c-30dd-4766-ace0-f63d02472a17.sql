ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'board',
  ADD COLUMN IF NOT EXISTS boss_hp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boss_max_hp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boss_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS boss_defeated_at timestamptz;