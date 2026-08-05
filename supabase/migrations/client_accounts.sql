-- ============================================================
-- Client accounts: profiles table with role + discount_percent
--
-- Closed registration: admins create client accounts manually.
-- Each client gets a permanent personal discount (discount_percent).
-- The profile `id` equals the auth.users id (one profile per user).
--
-- Staff roles stay in `user_roles`; `profiles.role` is 'client' only.
-- ============================================================

create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             text not null default 'client' check (role in ('client')),
  discount_percent integer not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  full_name        text,
  phone            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-create a default profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or has_role(auth.uid(), 'admin'));

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert with check (has_role(auth.uid(), 'admin'));

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete using (has_role(auth.uid(), 'admin'));
