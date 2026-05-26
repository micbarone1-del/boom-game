
CREATE TABLE public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  avatar_url text,
  score integer NOT NULL DEFAULT 0,
  finish_rank integer,
  room_code text NOT NULL,
  pod_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_results TO anon;
GRANT SELECT, INSERT ON public.game_results TO authenticated;
GRANT ALL ON public.game_results TO service_role;

ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "results readable by all"
  ON public.game_results FOR SELECT
  USING (true);

CREATE POLICY "users insert own results"
  ON public.game_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_game_results_score ON public.game_results (score DESC, created_at DESC);
CREATE INDEX idx_game_results_user ON public.game_results (user_id);

CREATE OR REPLACE FUNCTION public.bump_profile_on_game_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET lifetime_score = COALESCE(lifetime_score, 0) + COALESCE(NEW.score, 0),
         games_finished = COALESCE(games_finished, 0) + 1,
         updated_at = now()
   WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_profile_on_game_result
AFTER INSERT ON public.game_results
FOR EACH ROW EXECUTE FUNCTION public.bump_profile_on_game_result();
