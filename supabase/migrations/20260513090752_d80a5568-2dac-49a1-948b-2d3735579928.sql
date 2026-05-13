-- Restrict avatars bucket to image MIME types and a 2 MB size limit
UPDATE storage.buckets
SET
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp']
WHERE id = 'avatars';

-- handle_new_user is only meant to fire from the auth trigger; revoke direct EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;