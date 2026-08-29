-- 1) Remove weaker/overlapping avatar storage policies (keep the owner-folder-scoped ones)
DROP POLICY IF EXISTS "avatars_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_authenticated" ON storage.objects;

-- 2) Tighten players_update so user_id can only be NULL or the caller's own uid in the NEW row
DROP POLICY IF EXISTS "players_update" ON public.players;
CREATE POLICY "players_update" ON public.players
  FOR UPDATE
  USING (true)
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 3) Re-apply hijack/score guards (idempotent)
CREATE OR REPLACE FUNCTION public.guard_player_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'player row is already linked to an account';
  END IF;
  IF NEW.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'cannot link a player row to another account';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS players_user_id_guard ON public.players;
CREATE TRIGGER players_user_id_guard
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.guard_player_user_id();

CREATE OR REPLACE FUNCTION public.validate_game_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  player_score integer;
BEGIN
  SELECT p.score INTO player_score
  FROM public.players p
  WHERE p.user_id = NEW.user_id
    AND p.room_code = NEW.room_code
    AND p.finished_at IS NOT NULL
  ORDER BY p.finished_at DESC
  LIMIT 1;

  IF player_score IS NULL THEN
    RAISE EXCEPTION 'no finished player row for this account in room %', NEW.room_code;
  END IF;
  IF NEW.score < 0 OR NEW.score > player_score THEN
    RAISE EXCEPTION 'submitted score does not match server-tracked score';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS game_results_validate ON public.game_results;
CREATE TRIGGER game_results_validate
  BEFORE INSERT ON public.game_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_game_result();

REVOKE ALL ON FUNCTION public.guard_player_user_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_game_result() FROM PUBLIC, anon, authenticated;