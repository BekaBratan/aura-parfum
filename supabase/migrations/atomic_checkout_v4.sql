-- ============================================================
-- Atomic checkout v4: extend stored order items with attributes,
-- gender, country_of_origin, code (so invoices / PDF can display
-- the same badges as the catalog).
-- Run after atomic_checkout_v3 and after ainur_id / product_code migrations.
-- ============================================================

create or replace function public.create_order_with_stock_check(
  p_customer_name     text,
  p_customer_phone    text,
  p_customer_city     text,
  p_customer_address  text,
  p_comment           text,
  p_items             jsonb,
  p_currency_code     text    DEFAULT 'KZT',
  p_rate_to_usd       numeric DEFAULT 460
)
returns table(order_id uuid, invoice_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item        record;
  v_product     record;
  v_total_usd   numeric(12,2) := 0;
  v_order_items jsonb          := '[]'::jsonb;
  v_order_id    uuid;
  v_invoice_number text;
  v_volume_ml   integer;
  v_unit_label  text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Корзина пуста';
  end if;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null
    or nullif(trim(coalesce(p_customer_phone, '')), '') is null
    or nullif(trim(coalesce(p_customer_city, '')), '') is null
    or nullif(trim(coalesce(p_customer_address, '')), '') is null then
    raise exception 'Заполните обязательные поля';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as item
    where nullif(item->>'product_id', '') is null
  ) then
    raise exception 'Некорректный товар в корзине';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as item
    where nullif(item->>'quantity', '') is null
      or (item->>'quantity')::integer <= 0
  ) then
    raise exception 'Некорректное количество товара';
  end if;

  for v_item in
    select
      parsed.product_id,
      sum(parsed.quantity)::integer as quantity
    from (
      select
        (item->>'product_id')::uuid  as product_id,
        (item->>'quantity')::integer as quantity
      from jsonb_array_elements(p_items) as item
    ) as parsed
    group by parsed.product_id
    order by parsed.product_id
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Некорректный товар или количество в корзине';
    end if;

    select
      products.id,
      products.name,
      products.brand,
      products.price_usd,
      products.volume_ml,
      products.image_url,
      products.count,
      products.unit,
      products.category,
      products.attributes,
      products.gender,
      products.country_of_origin,
      products.code
    into v_product
    from public.products
    where products.id = v_item.product_id
    for update;

    if not found then
      raise exception 'Товар не найден: %', v_item.product_id;
    end if;

    if coalesce(v_product.count, 0) <= 0 then
      raise exception 'Товар закончился: %. Удалите его из корзины.', v_product.name;
    end if;

    if v_product.count < v_item.quantity then
      v_unit_label := case when v_product.unit = 'ml' then 'мл' else 'шт.' end;
      raise exception 'Недостаточно товара: %. В корзине: % %, доступно: % %.',
        v_product.name, v_item.quantity, v_unit_label, v_product.count, v_unit_label;
    end if;

    update public.products
    set count = products.count - v_item.quantity
    where products.id = v_product.id;

    v_total_usd := v_total_usd + (v_product.price_usd * v_item.quantity);

    v_volume_ml := case when v_product.unit = 'ml' then v_item.quantity else null end;

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id',         v_product.id,
        'name',               v_product.name,
        'brand',              v_product.brand,
        'price_usd',          v_product.price_usd,
        'quantity',           v_item.quantity,
        'volume_ml',          v_volume_ml,
        'image_url',          v_product.image_url,
        'unit',               v_product.unit,
        'category',           v_product.category,
        'attributes',         coalesce(v_product.attributes, '{}'::jsonb),
        'gender',             v_product.gender,
        'country_of_origin',  v_product.country_of_origin,
        'code',               v_product.code
      )
    );
  end loop;

  insert into public.orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    comment,
    items,
    total_usd,
    display_currency_code,
    total_display_currency,
    payment_status,
    order_status
  )
  values (
    p_customer_name,
    p_customer_phone,
    p_customer_city,
    p_customer_address,
    nullif(p_comment, ''),
    v_order_items,
    v_total_usd,
    p_currency_code,
    ROUND(v_total_usd * p_rate_to_usd, 0),
    'pending_payment',
    'new'
  )
  returning id, public.orders.invoice_number
  into v_order_id, v_invoice_number;

  return query select v_order_id, v_invoice_number;
end;
$$;

grant execute on function public.create_order_with_stock_check(text,text,text,text,text,jsonb,text,numeric) to anon;
grant execute on function public.create_order_with_stock_check(text,text,text,text,text,jsonb,text,numeric) to authenticated;
