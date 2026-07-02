-- ============================================================
-- Atomic checkout v7: skip stock deduction for Ainur-linked items
--
-- The client now sends `ainur_id` per item (the 24-char AinurPOS id).
-- The RPC stores it in the order item JSON and skips the
-- `update products set count = ...` for items that have an ainur_id,
-- because their real stock lives in AinurPOS, not in Supabase.
--
-- For items WITHOUT ainur_id the existing deduction stays in place
-- (Supabase-managed stock).
--
-- Run AFTER atomic_checkout_v6.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_order_with_stock_check(
  p_customer_name      text,
  p_customer_phone     text,
  p_customer_city      text,
  p_customer_address   text,
  p_comment            text,
  p_items              jsonb,
  p_currency_code      text    DEFAULT 'KZT',
  p_rate_to_usd        numeric DEFAULT 460,
  p_discount_kzt       numeric DEFAULT 0,
  p_applied_discounts  jsonb   DEFAULT '[]'::jsonb
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
  v_discount_kzt numeric(12,2) := coalesce(p_discount_kzt, 0);
  v_applied     jsonb         := coalesce(p_applied_discounts, '[]'::jsonb);
  v_line_disc   numeric(12,2);
  v_line_name   text;
  v_ainur_id    text;
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

  if v_discount_kzt < 0 then
    raise exception 'Скидка не может быть отрицательной';
  end if;

  -- Aggregate per-line info by product_id (cart already dedupes, but be safe)
  for v_item in
    select
      parsed.product_id,
      sum(parsed.quantity)::integer       as quantity,
      sum(coalesce(parsed.discount_kzt, 0)) as discount_kzt,
      max(parsed.applied_discount_name)   as applied_discount_name,
      -- Ainur id from the first occurrence (should be same for all)
      min(parsed.ainur_id)                as ainur_id
    from (
      select
        (item->>'product_id')::uuid               as product_id,
        (item->>'quantity')::integer              as quantity,
        nullif(item->>'discount_kzt', '')::numeric as discount_kzt,
        nullif(item->>'applied_discount_name', '') as applied_discount_name,
        nullif(item->>'ainur_id', '')             as ainur_id
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
      products.code,
      products.min_volume
    into v_product
    from public.products
    where products.id = v_item.product_id
    for update;

    if not found then
      raise exception 'Товар не найден: %', v_item.product_id;
    end if;

    -- Only check Supabase stock for items WITHOUT ainur_id
    -- (Ainur-linked stock is validated by the JIT check before submit)
    if v_item.ainur_id is null then
      if coalesce(v_product.count, 0) <= 0 then
        raise exception 'Товар закончился: %. Удалите его из корзины.', v_product.name;
      end if;

      if v_product.count < v_item.quantity then
        v_unit_label := case when v_product.unit = 'ml' then 'мл' else 'шт.' end;
        raise exception 'Недостаточно товара: %. В корзине: % %, доступно: % %.',
          v_product.name, v_item.quantity, v_unit_label, v_product.count, v_unit_label;
      end if;

      if v_product.unit = 'ml' and coalesce(v_product.min_volume, 1) > v_item.quantity then
        raise exception 'Минимальный объём заказа — % мл: %. Увеличьте количество в корзине.',
          coalesce(v_product.min_volume, 1), v_product.name;
      end if;

      -- Deduct from Supabase stock for locally-managed products
      update public.products
      set count = products.count - v_item.quantity
      where products.id = v_product.id;
    end if;

    v_total_usd := v_total_usd + (v_product.price_usd * v_item.quantity);

    v_volume_ml := case when v_product.unit = 'ml' then v_item.quantity else null end;

    -- null out the snapshot if the client didn't pass a positive cut
    v_line_disc := case
      when v_item.discount_kzt is null or v_item.discount_kzt <= 0 then null
      else v_item.discount_kzt
    end;
    v_line_name := case when v_line_disc is null then null else v_item.applied_discount_name end;

    v_ainur_id := v_item.ainur_id; -- may be null for non-Ainur items

    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'product_id',             v_product.id,
        'name',                   v_product.name,
        'brand',                  v_product.brand,
        'price_usd',              v_product.price_usd,
        'quantity',               v_item.quantity,
        'volume_ml',              v_volume_ml,
        'image_url',              v_product.image_url,
        'unit',                   v_product.unit,
        'category',               v_product.category,
        'attributes',             coalesce(v_product.attributes, '{}'::jsonb),
        'gender',                 v_product.gender,
        'country_of_origin',      v_product.country_of_origin,
        'code',                   v_product.code,
        'discount_kzt',           v_line_disc,
        'applied_discount_name',  v_line_name,
        'ainur_id',               v_ainur_id
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
    discount_kzt,
    applied_discounts,
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
    GREATEST(0, ROUND(v_total_usd * p_rate_to_usd, 0) - v_discount_kzt),
    v_discount_kzt,
    v_applied,
    'pending_payment',
    'new'
  )
  returning id, public.orders.invoice_number
  into v_order_id, v_invoice_number;

  return query select v_order_id, v_invoice_number;
end;
$$;

grant execute on function public.create_order_with_stock_check(text,text,text,text,text,jsonb,text,numeric,numeric,jsonb) to anon;
grant execute on function public.create_order_with_stock_check(text,text,text,text,text,jsonb,text,numeric,numeric,jsonb) to authenticated;
