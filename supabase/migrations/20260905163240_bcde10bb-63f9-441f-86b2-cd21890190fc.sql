DROP FUNCTION IF EXISTS public.record_my_game_result(uuid);

GRANT INSERT ON public.game_results TO authenticated;

CREATE POLICY "users insert validated own results"
ON public.game_results
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.user_id = auth.uid()
      AND p.room_code = game_results.room_code
      AND p.pod_id IS NOT DISTINCT FROM game_results.pod_id
      AND p.username = game_results.username
      AND p.avatar_url IS NOT DISTINCT FROM game_results.avatar_url
      AND p.score = game_results.score
      AND p.finish_rank IS NOT DISTINCT FROM game_results.finish_rank
      AND p.status = 'finished'
      AND p.finished_at IS NOT NULL
  )
);