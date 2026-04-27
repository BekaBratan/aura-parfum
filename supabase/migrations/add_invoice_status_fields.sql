-- Safe migration: invoice and status fields for existing Aura Parfum orders.
-- This migration preserves existing products and orders.

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

alter table orders
  add column if not exists invoice_number text,
  add column if not exists payment_status text default 'pending_payment',
  add column if not exists order_status text default 'new',
  add column if not exists customer_phone text,
  add column if not exists customer_name text,
  add column if not exists customer_city text,
  add column if not exists customer_address text,
  add column if not exists total_price numeric(12,2),
  add column if not exists items jsonb,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'invoice_number'
  ) then
    alter table orders alter column invoice_number set default generate_invoice_number();
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'payment_status'
  ) then
    alter table orders alter column payment_status set default 'pending_payment';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'order_status'
  ) then
    alter table orders alter column order_status set default 'new';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'created_at'
  ) then
    alter table orders alter column created_at set default now();
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'phone'
  ) then
    alter table orders alter column phone drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'name'
  ) then
    alter table orders alter column name drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'city'
  ) then
    alter table orders alter column city drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'address'
  ) then
    alter table orders alter column address drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'total'
  ) then
    alter table orders alter column total drop not null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_invoice_number_key'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table orders add constraint orders_invoice_number_key unique (invoice_number);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table orders add constraint orders_payment_status_check
      check (payment_status in ('pending_payment','paid','failed','refunded'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_order_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table orders add constraint orders_order_status_check
      check (order_status in ('new','confirmed','shipped','delivered','cancelled'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'orders_select_invoice_public'
  ) then
    create policy "orders_select_invoice_public" on orders
      for select using (true);
  end if;
end;
$$;
