ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS game_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS game_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS game_state text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS continue_deadline_at timestamptz;