-- ============================================================
-- Discount engine — v3: add `category_per_product` trigger type
--
-- Per-line evaluation inside chosen categories: each cart line
-- whose category matches AND whose qty × price ≥ threshold gets
-- the discount independently. Pairs only with apply_to='trigger_product'.
--
-- Incremental — does NOT touch existing rows. Run AFTER discounts_v2.sql.
-- ============================================================

-- ─── 1. Replace trigger_type CHECK constraint ─────────────────────────────
-- Locate by definition (constraint name is auto-generated), drop, then re-add
-- with the new enum value included.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.discounts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%trigger_type%'
      AND pg_get_constraintdef(oid) ILIKE '%all_cart%'
  LOOP
    EXECUTE format('ALTER TABLE public.discounts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.discounts
  ADD CONSTRAINT discounts_trigger_type_check
    CHECK (trigger_type IN ('all_cart','category_total','specific_products','category_per_product'));

-- ─── 2. Replace trigger_product_requires_specific_trigger constraint ──────
-- Now also allows apply_to='trigger_product' when trigger is category_per_product.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.discounts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%apply_to%trigger_product%'
  LOOP
    EXECUTE format('ALTER TABLE public.discounts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.discounts
  ADD CONSTRAINT trigger_product_requires_specific_trigger
    CHECK (
      apply_to <> 'trigger_product'
      OR trigger_type IN ('specific_products','category_per_product')
    );
