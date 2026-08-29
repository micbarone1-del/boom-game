
CREATE OR REPLACE FUNCTION public.guard_player_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'player row is already linked to an account';
  END IF;
  IF NEW.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'cannot link a player row to another account';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS players_user_id_guard ON public.players;
CREATE TRIGGER players_user_id_guard
BEFORE UPDATE OF user_id ON public.players
FOR EACH ROW EXECUTE FUNCTION public.guard_player_user_id();

CREATE OR REPLACE FUNCTION public.validate_game_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS game_results_validate ON public.game_results;
CREATE TRIGGER game_results_validate
BEFORE INSERT ON public.game_results
FOR EACH ROW EXECUTE FUNCTION public.validate_game_result();

DROP POLICY IF EXISTS players_all ON public.players;
DROP POLICY IF EXISTS pods_all ON public.pods;
DROP POLICY IF EXISTS rooms_all ON public.rooms;
DROP POLICY IF EXISTS logs_all ON public.workout_logs;

CREATE POLICY players_select ON public.players FOR SELECT TO public USING (true);
CREATE POLICY players_insert ON public.players FOR INSERT TO public WITH CHECK (true);
CREATE POLICY players_update ON public.players FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY pods_select ON public.pods FOR SELECT TO public USING (true);
CREATE POLICY pods_insert ON public.pods FOR INSERT TO public WITH CHECK (true);
CREATE POLICY pods_update ON public.pods FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY rooms_select ON public.rooms FOR SELECT TO public USING (true);
CREATE POLICY rooms_insert ON public.rooms FOR INSERT TO public WITH CHECK (true);
CREATE POLICY rooms_update ON public.rooms FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY logs_select ON public.workout_logs FOR SELECT TO public USING (true);
CREATE POLICY logs_insert ON public.workout_logs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY logs_update ON public.workout_logs FOR UPDATE TO public USING (true) WITH CHECK (true);

REVOKE DELETE ON public.players FROM anon, authenticated;
REVOKE DELETE ON public.pods FROM anon, authenticated;
REVOKE DELETE ON public.rooms FROM anon, authenticated;
REVOKE DELETE ON public.workout_logs FROM anon, authenticated;

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects
FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_owner_write ON storage.objects;
CREATE POLICY avatars_owner_write ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
CREATE POLICY avatars_owner_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_owner_delete ON storage.objects;
CREATE POLICY avatars_owner_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
