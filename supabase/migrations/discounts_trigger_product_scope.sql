-- ============================================================
-- Discounts: new scope_type value `trigger_product`.
-- The discount applies only to the product that is also the
-- condition trigger (i.e. condition_product_id), so the operator
-- can express "buy ≥5 of X → 10% off X" by setting:
--   scope_type = 'trigger_product'
--   condition_scope = 'product'
--   condition_product_id = X
--   condition_type = 'quantity', condition_threshold = 5
-- Run after discounts.sql.
-- ============================================================

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.discounts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%scope_type%IN%';
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.discounts DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END$$;

ALTER TABLE public.discounts
  ADD CONSTRAINT discounts_scope_type_check
  CHECK (scope_type IN ('all', 'category', 'products', 'trigger_product'));
