-- Safe migration: clean legacy order columns and allow cashier staff roles.
-- Run after add_invoice_status_fields.sql.

alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_city text,
  add column if not exists customer_address text,
  add column if not exists total_price numeric(12,2),
  add column if not exists order_status text default 'new',
  add column if not exists payment_status text default 'pending_payment',
  add column if not exists invoice_number text,
  add column if not exists items jsonb,
  add column if not exists comment text,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'name'
  ) then
    execute 'update public.orders set customer_name = name where customer_name is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'phone'
  ) then
    execute 'update public.orders set customer_phone = phone where customer_phone is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'city'
  ) then
    execute 'update public.orders set customer_city = city where customer_city is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'address'
  ) then
    execute 'update public.orders set customer_address = address where customer_address is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'total'
  ) then
    execute 'update public.orders set total_price = total where total_price is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'status'
  ) then
    execute 'update public.orders set order_status = status where order_status is null';
  end if;
end;
$$;

update public.orders
set payment_status = 'pending_payment'
where payment_status is null;

update public.orders
set order_status = 'new'
where order_status is null;

alter table public.orders
  alter column payment_status set default 'pending_payment',
  alter column order_status set default 'new',
  alter column created_at set default now();

alter table public.orders
  drop column if exists name,
  drop column if exists phone,
  drop column if exists city,
  drop column if exists address,
  drop column if exists total,
  drop column if exists status;

do $$
declare
  constraint_name text;
begin
  select c.conname
  into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'user_roles'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%role%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.user_roles drop constraint %I', constraint_name);
  end if;

  alter table public.user_roles
    add constraint user_roles_role_check check (role in ('admin', 'cashier'));
end;
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

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'user_roles_select_own'
  ) then
    alter policy "user_roles_select_own" on public.user_roles
      using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));
  else
    create policy "user_roles_select_own" on public.user_roles
      for select using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'user_roles_insert_admin'
  ) then
    create policy "user_roles_insert_admin" on public.user_roles
      for insert with check (has_role(auth.uid(), 'admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'user_roles_delete_admin'
  ) then
    create policy "user_roles_delete_admin" on public.user_roles
      for delete using (has_role(auth.uid(), 'admin'));
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'orders_select_admin'
  ) then
    alter policy "orders_select_admin" on public.orders
      using (has_staff_role(auth.uid()));
  else
    create policy "orders_select_admin" on public.orders
      for select using (has_staff_role(auth.uid()));
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'orders_update_admin'
  ) then
    alter policy "orders_update_admin" on public.orders
      using (has_staff_role(auth.uid()))
      with check (has_staff_role(auth.uid()));
  else
    create policy "orders_update_admin" on public.orders
      for update using (has_staff_role(auth.uid()))
      with check (has_staff_role(auth.uid()));
  end if;
end;
$$;
