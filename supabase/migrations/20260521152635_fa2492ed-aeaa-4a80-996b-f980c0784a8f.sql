
CREATE TABLE public.pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL,
  slot integer NOT NULL,
  name text NOT NULL,
  current_space integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'lobby',
  current_turn_player_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_code, slot)
);

ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;

CREATE POLICY pods_all ON public.pods FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.players ADD COLUMN pod_id uuid;
CREATE INDEX idx_players_pod_id ON public.players(pod_id);
CREATE INDEX idx_pods_room_code ON public.pods(room_code);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pods;
ALTER TABLE public.pods REPLICA IDENTITY FULL;
