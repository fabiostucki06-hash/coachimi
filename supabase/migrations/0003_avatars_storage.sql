-- Public avatar bucket + write policies restricted to the uploader's own folder
-- (see services/profile.ts, which uploads to `${userId}/avatar.jpg`).
--
-- Public (not signed URLs): avatars are shown across the app - Dashboard header,
-- Profile, Friends Feed (see components/features/UserAvatar.tsx) - including to
-- other users viewing a friend's card, so a public bucket + getPublicUrl() is far
-- simpler than minting a signed URL per viewer. Idempotent, same
-- drop-policy-if-exists convention as 0001/0002.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

alter table storage.objects enable row level security;

-- Object paths are `${userId}/avatar.jpg`, so the first path segment is the
-- owning user's id - the same shape Supabase's own docs use for per-user folders.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
