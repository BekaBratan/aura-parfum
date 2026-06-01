-- ============================================================
-- Per-discount currency selector.
--
-- A single `currency_code` per rule applies to BOTH the trigger threshold
-- and the fixed-amount discount value:
--   * 'USD' (default, backwards-compatible) — threshold is USD, fixed value
--      is USD (engine converts to KZT via current kzt rate at calc time)
--   * 'KZT' — threshold is KZT (engine compares against line KZT directly),
--      fixed value is KZT (no conversion)
--
-- Percentage discounts ignore this field (value is always a percent).
--
-- Existing rows: defaulted to 'USD' so the engine keeps working as before.
--
-- Run AFTER discounts_v3_category_per_product.sql.
-- ============================================================

ALTER TABLE public.discounts
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'USD';

-- Replace constraint by definition (idempotent in case of re-run)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.discounts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%currency_code%'
  LOOP
    EXECUTE format('ALTER TABLE public.discounts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.discounts
  ADD CONSTRAINT discounts_currency_code_check
    CHECK (currency_code IN ('USD', 'KZT'));
