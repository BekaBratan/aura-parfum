-- ============================================
-- Aura Parfum — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- PRODUCTS TABLE
-- ─────────────────────────────────────────
create table if not exists products (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  brand       text not null,
  description text,
  price       numeric(12,2) not null,
  gender      text check (gender in ('men','women','unisex')) default 'unisex',
  volume_ml   integer,
  image_url   text,
  count       integer not null default 0,
  is_featured boolean default false,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- ORDERS TABLE
-- ─────────────────────────────────────────
create table if not exists invoice_counters (
  invoice_year integer primary key,
  last_number integer not null default 0
);

create or replace function generate_invoice_number()
returns text
language plpgsql
as $$
declare
  current_year integer := extract(year from now())::integer;
  next_number integer;
begin
  insert into invoice_counters (invoice_year, last_number)
  values (current_year, 1)
  on conflict (invoice_year)
  do update set last_number = invoice_counters.last_number + 1
  returning last_number into next_number;

  return 'AP-' || current_year::text || '-' || lpad(next_number::text, 6, '0');
end;
$$;

create table if not exists orders (
  id                uuid primary key default uuid_generate_v4(),
  invoice_number    text unique not null default generate_invoice_number(),
  payment_status    text not null check (payment_status in ('pending_payment','paid','failed','refunded')) default 'pending_payment',
  order_status      text not null check (order_status in ('new','confirmed','shipped','delivered','cancelled')) default 'new',
  customer_phone    text not null,
  customer_name     text not null,
  customer_city     text not null,
  customer_address  text not null,
  comment           text,
  total_price       numeric(12,2) not null,
  items             jsonb not null,
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────
-- USER ROLES TABLE
-- ─────────────────────────────────────────
create table if not exists user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','cashier')),
  created_at timestamptz default now(),
  unique(user_id, role)
);

create or replace function has_role(user_id uuid, role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from user_roles
    where user_roles.user_id = $1
      and user_roles.role = $2
  );
$$;

create or replace function has_staff_role(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from user_roles
    where user_roles.user_id = $1
      and user_roles.role in ('admin', 'cashier')
  );
$$;

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────

alter table user_roles enable row level security;

drop policy if exists "user_roles_select_own" on user_roles;
create policy "user_roles_select_own" on user_roles
  for select using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));

drop policy if exists "user_roles_insert_admin" on user_roles;
create policy "user_roles_insert_admin" on user_roles
  for insert with check (has_role(auth.uid(), 'admin'));

drop policy if exists "user_roles_delete_admin" on user_roles;
create policy "user_roles_delete_admin" on user_roles
  for delete using (has_role(auth.uid(), 'admin'));

-- Products: anyone can read, only admins can write
alter table products enable row level security;

drop policy if exists "products_select_all" on products;
create policy "products_select_all" on products
  for select using (true);

drop policy if exists "products_insert_auth" on products;
drop policy if exists "products_insert_admin" on products;
create policy "products_insert_admin" on products
  for insert with check (has_role(auth.uid(), 'admin'));

drop policy if exists "products_update_auth" on products;
drop policy if exists "products_update_admin" on products;
create policy "products_update_admin" on products
  for update using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

drop policy if exists "products_delete_auth" on products;
drop policy if exists "products_delete_admin" on products;
create policy "products_delete_admin" on products
  for delete using (has_role(auth.uid(), 'admin'));

-- Orders: anyone can insert (guest checkout), staff can read/update, only admins can delete
alter table orders enable row level security;

drop policy if exists "orders_insert_all" on orders;
create policy "orders_insert_all" on orders
  for insert with check (true);

drop policy if exists "orders_select_auth" on orders;
drop policy if exists "orders_select_admin" on orders;
drop policy if exists "orders_select_invoice_public" on orders;
create policy "orders_select_admin" on orders
  for select using (has_staff_role(auth.uid()));

create policy "orders_select_invoice_public" on orders
  for select using (true);

drop policy if exists "orders_update_auth" on orders;
drop policy if exists "orders_update_admin" on orders;
create policy "orders_update_admin" on orders
  for update using (has_staff_role(auth.uid()))
  with check (has_staff_role(auth.uid()));

drop policy if exists "orders_delete_admin" on orders;
create policy "orders_delete_admin" on orders
  for delete using (has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────
-- SAMPLE PRODUCTS (optional seed data)
-- ─────────────────────────────────────────
insert into products (name, brand, description, price, gender, volume_ml, image_url, count, is_featured) values
  ('Bleu de Chanel', 'Chanel', 'Свежий древесно-ароматический аромат для мужчин. Нотки цитрусовых, ладана и сандала.', 85000, 'men', 100, 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=600', 5, true),
  ('Miss Dior', 'Dior', 'Романтический цветочный аромат с нотками пиона, жасмина и мускуса.', 79000, 'women', 50, 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600', 5, true),
  ('Black Opium', 'YSL', 'Чувственный аромат с нотками кофе, ванили и белых цветов.', 72000, 'women', 90, 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600', 5, false),
  ('Sauvage', 'Dior', 'Дикий и свежий аромат с нотками бергамота, перца и амброксана.', 89000, 'men', 100, 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600', 5, true),
  ('Coco Mademoiselle', 'Chanel', 'Изящный восточно-цветочный аромат с нотками апельсина, розы и пачули.', 91000, 'women', 100, 'https://images.unsplash.com/photo-1619994403073-2cec844b8e63?w=600', 5, false),
  ('Aventus', 'Creed', 'Легендарный фруктово-шипровый аромат для сильных мужчин.', 195000, 'men', 50, 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600', 5, true),
  ('La Vie est Belle', 'Lancôme', 'Сладкий цветочный аромат с нотками ириса, жасмина и пралине.', 68000, 'women', 75, 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=600', 5, false),
  ('Acqua di Gio', 'Giorgio Armani', 'Освежающий морской аромат с нотками бергамота, моря и кедра.', 65000, 'men', 100, 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600', 0, false);
