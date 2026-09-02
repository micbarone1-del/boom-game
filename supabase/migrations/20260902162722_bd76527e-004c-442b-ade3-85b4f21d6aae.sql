
-- Helper: is a room an active (recent) session?
CREATE OR REPLACE FUNCTION public.is_active_room(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.code = _code
      AND r.created_at > now() - interval '24 hours'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_room(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_room(text) TO anon, authenticated, service_role;

-- ROOMS ---------------------------------------------------------------
DROP POLICY IF EXISTS rooms_insert ON public.rooms;
DROP POLICY IF EXISTS rooms_update ON public.rooms;

CREATE POLICY rooms_insert ON public.rooms
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'lobby' AND locked = false);

CREATE POLICY rooms_update ON public.rooms
  FOR UPDATE TO anon, authenticated
  USING (created_at > now() - interval '24 hours')
  WITH CHECK (created_at > now() - interval '24 hours');

CREATE OR REPLACE FUNCTION public.rooms_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'room code cannot be changed';
  END IF;
  IF NEW.host_id IS DISTINCT FROM OLD.host_id THEN
    RAISE EXCEPTION 'room host cannot be changed';
  END IF;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_guard_immutable_trg ON public.rooms;
CREATE TRIGGER rooms_guard_immutable_trg
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.rooms_guard_immutable();

-- PLAYERS -------------------------------------------------------------
DROP POLICY IF EXISTS players_insert ON public.players;
DROP POLICY IF EXISTS players_update ON public.players;

CREATE POLICY players_insert ON public.players
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_active_room(room_code)
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY players_update ON public.players
  FOR UPDATE TO anon, authenticated
  USING (public.is_active_room(room_code))
  WITH CHECK (
    public.is_active_room(room_code)
    AND (
      user_id IS NULL
      OR (user_id = auth.uid() AND current_setting('app.allow_player_link', true) = 'on')
      OR user_id = (SELECT p.user_id FROM public.players p WHERE p.id = players.id)
    )
  );

CREATE OR REPLACE FUNCTION public.players_guard_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.room_code IS DISTINCT FROM OLD.room_code THEN
    RAISE EXCEPTION 'player cannot be moved to another room';
  END IF;
  NEW.joined_at := OLD.joined_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS players_guard_room_trg ON public.players;
CREATE TRIGGER players_guard_room_trg
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.players_guard_room();

-- WORKOUT LOGS --------------------------------------------------------
DROP POLICY IF EXISTS logs_insert ON public.workout_logs;
DROP POLICY IF EXISTS logs_update ON public.workout_logs;

CREATE POLICY logs_insert ON public.workout_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_active_room(room_code)
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = player_id AND p.room_code = workout_logs.room_code
    )
  );

CREATE POLICY logs_update ON public.workout_logs
  FOR UPDATE TO anon, authenticated
  USING (public.is_active_room(room_code))
  WITH CHECK (public.is_active_room(room_code));

CREATE OR REPLACE FUNCTION public.logs_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.player_id IS DISTINCT FROM OLD.player_id
     OR NEW.room_code IS DISTINCT FROM OLD.room_code THEN
    RAISE EXCEPTION 'workout log player/room cannot be changed';
  END IF;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS logs_guard_immutable_trg ON public.workout_logs;
CREATE TRIGGER logs_guard_immutable_trg
  BEFORE UPDATE ON public.workout_logs
  FOR EACH ROW EXECUTE FUNCTION public.logs_guard_immutable();
