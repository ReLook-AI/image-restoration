create extension if not exists pgcrypto;

create table if not exists public.restored_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_image_url text,
  restored_image_url text not null,
  image_url text generated always as (restored_image_url) stored,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create index if not exists restored_images_user_created_idx
on public.restored_images (user_id, created_at desc);

alter table public.restored_images enable row level security;

drop policy if exists "Users can view their own restored images" on public.restored_images;
create policy "Users can view their own restored images"
on public.restored_images
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own restored images" on public.restored_images;
create policy "Users can insert their own restored images"
on public.restored_images
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own restored images" on public.restored_images;
create policy "Users can delete their own restored images"
on public.restored_images
for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('restored-images', 'restored-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "Users can upload restored image files" on storage.objects;
create policy "Users can upload restored image files"
on storage.objects
for insert
with check (
  bucket_id = 'restored-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can view restored image files" on storage.objects;
create policy "Users can view restored image files"
on storage.objects
for select
using (bucket_id = 'restored-images');

drop policy if exists "Users can delete their restored image files" on storage.objects;
create policy "Users can delete their restored image files"
on storage.objects
for delete
using (
  bucket_id = 'restored-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
