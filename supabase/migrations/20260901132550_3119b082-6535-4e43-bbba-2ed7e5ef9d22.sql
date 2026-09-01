drop policy if exists "Clips readable by anyone with the link" on storage.objects;
create policy "Clips readable by anyone with the link"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'clips');

drop policy if exists "Anyone can upload a clip" on storage.objects;
create policy "Anyone can upload a clip"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'clips');