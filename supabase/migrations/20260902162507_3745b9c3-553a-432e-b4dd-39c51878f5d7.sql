-- 1) Account linking no longer runs with elevated privileges.
CREATE OR REPLACE FUNCTION public.link_player_to_me(_player_id uuid)
 RETURNS public.players
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.players;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO _row FROM public.players WHERE id = _player_id FOR UPDATE;
  IF _row IS NULL THEN
    RAISE EXCEPTION 'player not found';
  END IF;
  IF _row.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'player already linked';
  END IF;
  IF _row.finished_at IS NOT NULL THEN
    RAISE EXCEPTION 'cannot claim a finished player row';
  END IF;
  IF _row.joined_at < now() - interval '12 hours' THEN
    RAISE EXCEPTION 'player row too old to link';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.room_code = _row.room_code AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'already linked to a player in this room';
  END IF;

  PERFORM set_config('app.allow_player_link', 'on', true);
  UPDATE public.players SET user_id = auth.uid() WHERE id = _player_id RETURNING * INTO _row;
  PERFORM set_config('app.allow_player_link', 'off', true);

  RETURN _row;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_player_to_me(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_player_to_me(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_player_to_me(uuid) TO service_role;

-- 2) Claiming a player row is only possible through that checked path.
DROP POLICY IF EXISTS players_update ON public.players;
CREATE POLICY players_update ON public.players
  FOR UPDATE
  USING (true)
  WITH CHECK (
    user_id IS NULL
    OR (
      user_id = auth.uid()
      AND current_setting('app.allow_player_link', true) = 'on'
    )
  );