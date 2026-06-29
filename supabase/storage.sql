-- Run in Supabase SQL editor to create the photos storage bucket

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Allow active users to upload
create policy "active users upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and (select status from profiles where id = auth.uid()) = 'active'
  );

-- Anyone can read (bucket is public)
create policy "public read photos"
  on storage.objects for select
  using (bucket_id = 'photos');
