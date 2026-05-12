-- Run backend/supabase-image-history.sql first so public.restored_images exists.

alter table public.profiles
add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
    add constraint profiles_role_check
    check (role in ('user', 'admin'))
    not valid;
  end if;
end;
$$;

alter table public.profiles validate constraint profiles_role_check;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
using (public.is_admin());

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
on public.profiles
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can view all restored images" on public.restored_images;
create policy "Admins can view all restored images"
on public.restored_images
for select
using (public.is_admin());

drop policy if exists "Admins can delete all restored images" on public.restored_images;
create policy "Admins can delete all restored images"
on public.restored_images
for delete
using (public.is_admin());

drop policy if exists "Admins can view all restored image files" on storage.objects;
create policy "Admins can view all restored image files"
on storage.objects
for select
using (
  bucket_id = 'restored-images'
  and public.is_admin()
);

drop policy if exists "Admins can delete all restored image files" on storage.objects;
create policy "Admins can delete all restored image files"
on storage.objects
for delete
using (
  bucket_id = 'restored-images'
  and public.is_admin()
);

-- Run this after replacing the email with your team's admin account.
-- update public.profiles
-- set role = 'admin'
-- where email = 'your-admin-email@example.com';
