
-- 1) Cap game_results.score to prevent leaderboard inflation
ALTER TABLE public.game_results
  ADD CONSTRAINT game_results_score_bounds CHECK (score >= 0 AND score <= 10000);

-- 2) Restrict profiles SELECT to authenticated users
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_authenticated
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) Tighten avatars storage policies: writes require auth, add DELETE
DROP POLICY IF EXISTS avatars_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_update ON storage.objects;

CREATE POLICY avatars_insert_authenticated
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY avatars_update_authenticated
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

CREATE POLICY avatars_delete_authenticated
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());
