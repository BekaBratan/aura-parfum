-- ============================================================
-- Two new product categories alongside oil / perfume / accessory:
--   * original — Saudi-style original perfume bottles (sold by pcs, KZT-priced)
--   * analog   — European/BIGHILL analog perfume bottles (sold by pcs, KZT-priced)
--
-- Both are priced directly in KZT (the price_usd column stores raw KZT for
-- these categories, same quirk as accessory). No USD conversion happens for
-- them anywhere in the codebase.
--
-- Touches three CHECK constraints:
--   * products.category
--   * discounts.trigger_category_ids (text[])
--   * discounts.apply_category_ids   (text[])
--
-- Run AFTER discounts_v2.sql + product_categories.sql.
-- ============================================================

-- ─── 1. Replace CHECK on products.category ───────────────────────────────
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%category%'
      AND pg_get_constraintdef(oid) ILIKE '%oil%'
  LOOP
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
    CHECK (category IN ('oil', 'perfume', 'accessory', 'original', 'analog'));

-- ─── 2. Replace CHECK on discounts.trigger_category_ids ──────────────────
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.discounts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%trigger_category_ids%'
  LOOP
    EXECUTE format('ALTER TABLE public.discounts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.discounts
  ADD CONSTRAINT discounts_trigger_category_ids_check
    CHECK (
      trigger_category_ids IS NULL
      OR trigger_category_ids <@ ARRAY['oil','perfume','accessory','original','analog']::text[]
    );

-- ─── 3. Replace CHECK on discounts.apply_category_ids ────────────────────
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.discounts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%apply_category_ids%'
  LOOP
    EXECUTE format('ALTER TABLE public.discounts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.discounts
  ADD CONSTRAINT discounts_apply_category_ids_check
    CHECK (
      apply_category_ids IS NULL
      OR apply_category_ids <@ ARRAY['oil','perfume','accessory','original','analog']::text[]
    );
