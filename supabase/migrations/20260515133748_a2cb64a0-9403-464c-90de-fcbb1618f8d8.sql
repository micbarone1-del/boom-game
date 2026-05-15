
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team_id text,
  ADD COLUMN IF NOT EXISTS is_team_lead boolean NOT NULL DEFAULT false;

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'reps';
