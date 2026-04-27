alter table public.products
  add column if not exists count integer not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'in_stock'
  ) then
    update public.products
    set count = case
      when in_stock = true and count = 0 then 1
      when in_stock = false then 0
      else count
    end;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_count_nonnegative'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_count_nonnegative check (count >= 0);
  end if;
end;
$$;

create or replace function public.decrement_product_count(
  p_product_id uuid,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available_count integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  update public.products
  set count = count - p_quantity
  where id = p_product_id
    and count >= p_quantity
  returning count into v_available_count;

  if found then
    return;
  end if;

  select count
  into v_available_count
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found: %', p_product_id;
  end if;

  raise exception 'Insufficient product count for %. Available: %, requested: %',
    p_product_id,
    v_available_count,
    p_quantity;
end;
$$;

grant execute on function public.decrement_product_count(uuid, integer) to anon;
grant execute on function public.decrement_product_count(uuid, integer) to authenticated;
