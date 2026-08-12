-- ============================================================
-- Atomic checkout v9: registered clients use ONLY their own discount
--
-- Behaviour change vs v8:
--   Until v8 a client's personal discount (profiles.discount_percent)
--   was combined with the general rule discounts via
--   GREATEST(rule, personal) — the more advantageous one won, so
--   rule discounts could / did apply to clients.
--
--   In v9 a registered client (profiles.role = 'client' and NOT staff)
--   gets ONLY their personal discount:
--     * all general rule discounts (any type / category) are ignored
--       and emptied from the order;
--     * the personal discount is computed over the subtotal of the
--       oil ("масло") and perfume ("парфюм") lines ONLY — accessories,
--       originals and analogs are excluded.
--
--   Guests / staff keep the old behaviour (rules + GREATEST).
--
-- Run AFTER atomic_checkout_v8.sql.
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
  v_is_client       boolean := false;
  v_personal_percent integer := 0;
  v_personal_sum numeric(12,2) := 0;
  v_base_kzt    numeric(12,2) := 0;
  v_oil_perfum_usd numeric(12,2) := 0;
  v_oil_perfum_kzt numeric(12,2) := 0;
  v_discount_sum numeric(12,2) := 0;
  v_discount_applied numeric(12,2) := 0;
  v_i           integer;
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

  -- Member check: a registered CLIENT is a profile with role 'client'
  -- and no staff role (admin/cashier). Staff and guests keep rules.
  if auth.uid() is not null and not public.has_staff_role(auth.uid()) then
    select coalesce(max(profiles.discount_percent), 0)
    into v_personal_percent
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'client';
    if found then
      v_is_client := true;
    end if;
  end if;
  v_personal_percent := least(100, greatest(0, coalesce(v_personal_percent, 0)));

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

    -- Client's personal discount applies to масло + парфюм lines only.
    if v_product.category in ('oil', 'perfume') then
      v_oil_perfum_usd := v_oil_perfum_usd + (v_product.price_usd * v_item.quantity);
    end if;

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

  -- Discount math.
  v_base_kzt       := greatest(0, round(v_total_usd * p_rate_to_usd, 0));
  v_oil_perfum_kzt := greatest(0, round(v_oil_perfum_usd * p_rate_to_usd, 0));

  if v_is_client then
    -- Registered clients: ONLY their personal discount, computed on the
    -- масло/парфюм subtotal. All general rule discounts are dropped.
    v_personal_sum    := round(v_oil_perfum_kzt * v_personal_percent / 100.0, 2);
    v_discount_applied := v_personal_sum;
    v_discount_sum    := v_personal_sum;
    v_discount_kzt    := 0;
    v_applied         := '[]'::jsonb;
    for v_i in 0 .. jsonb_array_length(v_order_items) - 1 loop
      v_order_items := jsonb_set(v_order_items, array[v_i::text, 'discount_kzt'], 'null');
      v_order_items := jsonb_set(v_order_items, array[v_i::text, 'applied_discount_name'], 'null');
    end loop;
  else
    -- Guests / staff: rule discounts + personal via GREATEST (v8 behaviour).
    v_personal_sum    := round(v_base_kzt * v_personal_percent / 100.0, 2);
    v_discount_applied := greatest(v_discount_kzt, v_personal_sum);

    if v_personal_sum > v_discount_kzt then
      -- Personal discount wins: clear per-line rule discounts so the order
      -- carries exactly one discount (the applied one).
      v_discount_sum := v_personal_sum;
      v_discount_kzt := 0;
      v_applied := '[]'::jsonb;
      for v_i in 0 .. jsonb_array_length(v_order_items) - 1 loop
        v_order_items := jsonb_set(v_order_items, array[v_i::text, 'discount_kzt'], 'null');
        v_order_items := jsonb_set(v_order_items, array[v_i::text, 'applied_discount_name'], 'null');
      end loop;
    end if;
  end if;

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
    kzt_rate,
    discount_kzt,
    applied_discounts,
    discount_percent,
    discount_sum,
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
    greatest(0, v_base_kzt - v_discount_applied),
    p_rate_to_usd,
    v_discount_kzt,
    v_applied,
    v_personal_percent,
    v_discount_sum,
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