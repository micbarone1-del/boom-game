
-- Tables
CREATE TABLE public.rooms (
  code TEXT PRIMARY KEY,
  host_id UUID NOT NULL DEFAULT gen_random_uuid(),
  difficulty_multiplier INT NOT NULL DEFAULT 5,
  current_turn_player_id UUID,
  locked BOOLEAN NOT NULL DEFAULT false,
  trap JSONB,
  last_dice INT,
  status TEXT NOT NULL DEFAULT 'lobby',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  username TEXT NOT NULL,
  fitness_level INT NOT NULL DEFAULT 5,
  avatar_url TEXT,
  current_space INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  player_id UUID NOT NULL,
  exercise_name TEXT NOT NULL,
  target_reps INT NOT NULL,
  time_taken_ms INT,
  verified_by_judge BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_room ON public.players(room_code);
CREATE INDEX idx_logs_room ON public.workout_logs(room_code);

-- RLS - permissive (party game with shared room code)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_all" ON public.rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "players_all" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "logs_all" ON public.workout_logs FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.workout_logs REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_logs;

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');
