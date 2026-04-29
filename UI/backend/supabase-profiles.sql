create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  current_plan text not null default 'free',
  plan_status text not null default 'active',
  plan_started_at timestamptz not null default now(),
  plan_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

alter table public.profiles
add column if not exists current_plan text not null default 'free',
add column if not exists plan_status text not null default 'active',
add column if not exists plan_started_at timestamptz not null default now(),
add column if not exists plan_expires_at timestamptz;

alter table public.profiles
alter column current_plan set default 'free';

drop policy if exists "Users can view their own profile" on public.profiles;

create policy "Users can view their own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, first_name, last_name, current_plan)
select
  users.id,
  users.email,
  users.raw_user_meta_data ->> 'first_name',
  users.raw_user_meta_data ->> 'last_name',
  'free'
from auth.users
left join public.profiles on profiles.id = users.id
where profiles.id is null;
