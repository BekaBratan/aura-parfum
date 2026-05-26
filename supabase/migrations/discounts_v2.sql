-- ============================================================
-- Discount engine — v2 (full rewrite of the discounts table)
--
-- Data model: two independent axes.
--   * Trigger:  what the customer needs to put in the cart to unlock the rule.
--   * Apply:    which cart lines actually get the reduced price.
--
-- Run AFTER discounts.sql + atomic_checkout_v5.sql.
-- Old `discounts` rows are test-only and incompatible — table is dropped.
-- ============================================================

-- ─── 1. Drop the old table ───────────────────────────────────────────────
DROP TABLE IF EXISTS public.discounts CASCADE;

-- ─── 2. Create v2 table ──────────────────────────────────────────────────
CREATE TABLE public.discounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  priority      integer NOT NULL DEFAULT 0,

  -- Trigger axis
  trigger_type             text NOT NULL CHECK (trigger_type IN ('all_cart','category_total','specific_products')),
  trigger_category_ids     text[] CHECK (
    trigger_category_ids IS NULL OR trigger_category_ids <@ ARRAY['oil','perfume','accessory']::text[]
  ),
  trigger_product_ids      uuid[],
  trigger_threshold_amount numeric(12,2) CHECK (trigger_threshold_amount IS NULL OR trigger_threshold_amount >= 0),
  trigger_min_quantity     integer CHECK (trigger_min_quantity IS NULL OR trigger_min_quantity > 0),

  -- Apply axis
  apply_to            text NOT NULL CHECK (apply_to IN ('all_cart','category','trigger_product','specific_products')),
  apply_category_ids  text[] CHECK (
    apply_category_ids IS NULL OR apply_category_ids <@ ARRAY['oil','perfume','accessory']::text[]
  ),
  apply_product_ids   uuid[],

  -- Value
  discount_type   text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value  numeric(12,2) NOT NULL CHECK (discount_value > 0),

  -- Validity window
  valid_from   timestamptz,
  valid_until  timestamptz,
  CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- apply_to='trigger_product' only makes sense paired with a specific-products trigger
  CONSTRAINT trigger_product_requires_specific_trigger
    CHECK (apply_to <> 'trigger_product' OR trigger_type = 'specific_products')
);

-- ─── 3. Indexes ──────────────────────────────────────────────────────────
CREATE INDEX discounts_active_idx   ON public.discounts (is_active) WHERE is_active = true;
CREATE INDEX discounts_priority_idx ON public.discounts (priority DESC) WHERE is_active = true;

-- ─── 4. RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active discounts" ON public.discounts;
CREATE POLICY "Public read active discounts" ON public.discounts
  FOR SELECT USING (
    is_active = true
    AND (valid_from  IS NULL OR valid_from  <= now())
    AND (valid_until IS NULL OR valid_until >= now())
  );

DROP POLICY IF EXISTS "Admin read all discounts" ON public.discounts;
CREATE POLICY "Admin read all discounts" ON public.discounts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin write discounts" ON public.discounts;
CREATE POLICY "Admin write discounts" ON public.discounts
  FOR ALL TO authenticated
  USING       (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK  (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ─── 5. updated_at trigger ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_discounts_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS discounts_touch_updated_at ON public.discounts;
CREATE TRIGGER discounts_touch_updated_at
  BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_discounts_updated_at();

-- ─── 6. One-off rewrite of old order snapshots ───────────────────────────
-- Existing orders stored applied_discounts items as {id, name, ...}.
-- New shape uses {discount_id, name, ...}. Rename in-place so existing
-- invoices / admin order details keep rendering correctly.
UPDATE public.orders
SET applied_discounts = (
  SELECT jsonb_agg(
    CASE
      WHEN item ? 'id' AND NOT (item ? 'discount_id')
        THEN (item - 'id') || jsonb_build_object('discount_id', item->'id')
      ELSE item
    END
  )
  FROM jsonb_array_elements(applied_discounts) AS item
)
WHERE jsonb_typeof(applied_discounts) = 'array'
  AND jsonb_array_length(applied_discounts) > 0;
