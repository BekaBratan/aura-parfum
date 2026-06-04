-- ============================================================
-- Country code lives on the country itself (product_options row), NOT on the
-- product row. Each country option gets an optional `code` field.
--
-- This replaces the earlier (wrong) per-product products.country_code column.
-- That column is dropped if present; existing data is recovered into the new
-- product_options.code by matching name + code from a seed table.
--
-- Run AFTER scripts/migration-product-options.sql (creates product_options).
-- Safe to run multiple times.
-- ============================================================

-- 1. Add the code column
ALTER TABLE public.product_options
  ADD COLUMN IF NOT EXISTS code text;

-- 2. Seed codes for known countries (idempotent — only fills if NULL)
UPDATE public.product_options
SET code = m.code
FROM (VALUES
  ('Турция',           'SL'),
  ('Франция',          'FR'),
  ('Швейцария',        'LZ'),
  ('Испания',          'SP'),
  ('Саудовская Аравия','SA'),
  ('ОАЭ',              'AE'),
  ('Германия',         'DE'),
  ('Италия',           'IT'),
  ('Великобритания',   'GB')
) AS m(value, code)
WHERE public.product_options.type = 'country'
  AND public.product_options.value = m.value
  AND public.product_options.code IS NULL;

-- 3. Ensure Саудовская Аравия exists (we use it for the imported "original" category)
INSERT INTO public.product_options (type, value, code)
SELECT 'country', 'Саудовская Аравия', 'SA'
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_options
  WHERE type = 'country' AND value = 'Саудовская Аравия'
);

-- 4. Public read policy for countries — visitors need the codes to render flags
DROP POLICY IF EXISTS "Public read country options" ON public.product_options;
CREATE POLICY "Public read country options" ON public.product_options
  FOR SELECT
  USING (type = 'country');

-- 5. Rescue any custom (country, code) pairs from the now-deprecated
--    products.country_code column BEFORE dropping it. Two passes:
--    (a) for countries that exist in product_options but have no code yet —
--        copy the code from the matching products row
--    (b) for countries that don't exist at all in product_options — insert them
--    Runs only if the column still exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'country_code'
  ) THEN
    -- (a) Fill missing codes on existing country options
    EXECUTE $sql$
      UPDATE public.product_options po
      SET code = sub.country_code
      FROM (
        SELECT DISTINCT p.country_of_origin AS name, p.country_code
        FROM public.products p
        WHERE p.country_code IS NOT NULL
          AND p.country_of_origin IS NOT NULL
      ) sub
      WHERE po.type = 'country'
        AND po.value = sub.name
        AND po.code IS NULL
    $sql$;

    -- (b) Add country options for any country_of_origin that isn't in the table yet
    EXECUTE $sql$
      INSERT INTO public.product_options (type, value, code)
      SELECT DISTINCT 'country', p.country_of_origin, p.country_code
      FROM public.products p
      WHERE p.country_of_origin IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.product_options po
          WHERE po.type = 'country' AND po.value = p.country_of_origin
        )
    $sql$;
  END IF;
END $$;

-- 6. Drop the wrong per-product column (data already preserved above)
ALTER TABLE public.products
  DROP COLUMN IF EXISTS country_code;
