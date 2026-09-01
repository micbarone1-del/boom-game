
-- 1) Avatars: consolidate duplicate/overlapping read + update policies
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_authenticated" ON storage.objects;
-- keeps single "avatars_read" (SELECT, bucket_id = 'avatars') and owner-folder write/update/delete

-- 2) Clips: no blanket public read; signed links still work. Path-scoped writes.
DROP POLICY IF EXISTS "Clips readable by anyone with the link" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload a clip" ON storage.objects;

CREATE POLICY "clips_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "clips_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clips' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "clips_guest_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'clips' AND (storage.foldername(name))[1] = 'guest');

CREATE POLICY "clips_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- 3) Player score hijack: user_id can never be changed by a direct update.
CREATE OR REPLACE FUNCTION public.players_guard_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND current_setting('app.allow_player_link', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'user_id cannot be changed directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS players_guard_user_id_trg ON public.players;
CREATE TRIGGER players_guard_user_id_trg
BEFORE UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.players_guard_user_id();

-- Inserts may only claim your own account
DROP POLICY IF EXISTS "players_insert" ON public.players;
CREATE POLICY "players_insert" ON public.players
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Checked linkage RPC: claim an unclaimed, recent player row, once, one per room.
CREATE OR REPLACE FUNCTION public.link_player_to_me(_player_id uuid)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.link_player_to_me(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.link_player_to_me(uuid) TO authenticated;
