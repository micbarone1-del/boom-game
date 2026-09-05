DROP POLICY IF EXISTS rooms_insert ON public.rooms;
DROP POLICY IF EXISTS rooms_update ON public.rooms;
GRANT SELECT, INSERT, UPDATE ON public.rooms TO anon, authenticated;
CREATE POLICY rooms_insert ON public.rooms FOR INSERT TO anon, authenticated
  WITH CHECK (((host_id IS NULL) OR (host_id = auth.uid())) AND status = 'lobby' AND locked = false);
CREATE POLICY rooms_update ON public.rooms FOR UPDATE TO anon, authenticated
  USING (created_at > now() - interval '24 hours')
  WITH CHECK (created_at > now() - interval '24 hours');