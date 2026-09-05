-- Fix player score hijacking by removing direct client-authored result inserts
DROP POLICY IF EXISTS "users insert own results" ON public.game_results;
REVOKE INSERT ON public.game_results FROM anon, authenticated;

DELETE FROM public.game_results a
USING public.game_results b
WHERE a.user_id = b.user_id
  AND a.room_code = b.room_code
  AND a.pod_id IS NOT DISTINCT FROM b.pod_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS game_results_one_per_user_player
  ON public.game_results (user_id, room_code, pod_id)
  NULLS NOT DISTINCT;

CREATE OR REPLACE FUNCTION public.record_my_game_result(_player_id uuid)
RETURNS public.game_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _player public.players;
  _result public.game_results;
  _rank integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO _player
  FROM public.players
  WHERE id = _player_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'linked player not found';
  END IF;

  IF _player.finished_at IS NULL OR _player.status <> 'finished' THEN
    RAISE EXCEPTION 'game is not finished';
  END IF;

  SELECT 1 + count(*)::integer INTO _rank
  FROM public.players p
  WHERE p.room_code = _player.room_code
    AND p.pod_id IS NOT DISTINCT FROM _player.pod_id
    AND p.score > _player.score;

  INSERT INTO public.game_results (
    user_id, username, avatar_url, score, finish_rank, room_code, pod_id
  ) VALUES (
    auth.uid(), _player.username, _player.avatar_url, _player.score,
    _rank, _player.room_code, _player.pod_id
  )
  ON CONFLICT (user_id, room_code, pod_id)
  DO NOTHING
  RETURNING * INTO _result;

  IF _result.id IS NULL THEN
    SELECT * INTO _result
    FROM public.game_results
    WHERE user_id = auth.uid()
      AND room_code = _player.room_code
      AND pod_id IS NOT DISTINCT FROM _player.pod_id;
  END IF;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_my_game_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_my_game_result(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_my_game_result(uuid) TO service_role;

-- Fix room takeover: only the authenticated host or a linked participant may update
DROP POLICY IF EXISTS "rooms_insert" ON public.rooms;
DROP POLICY IF EXISTS "rooms_update" ON public.rooms;

CREATE POLICY "rooms_insert"
ON public.rooms
FOR INSERT
TO authenticated
WITH CHECK (
  host_id = auth.uid()
  AND status = 'lobby'::text
  AND locked = false
);

CREATE POLICY "rooms_update"
ON public.rooms
FOR UPDATE
TO authenticated
USING (
  created_at > now() - interval '24 hours'
  AND (
    host_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.players p
      WHERE p.room_code = rooms.code
        AND p.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  created_at > now() - interval '24 hours'
  AND (
    host_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.players p
      WHERE p.room_code = rooms.code
        AND p.user_id = auth.uid()
    )
  )
);