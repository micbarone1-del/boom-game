
CREATE OR REPLACE FUNCTION public.is_active_room(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.code = _code
      AND r.created_at > now() - interval '24 hours'
  );
$$;

REVOKE ALL ON FUNCTION public.rooms_guard_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.players_guard_room() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.logs_guard_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.players_guard_user_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_player_user_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_game_result() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_profile_on_game_result() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
