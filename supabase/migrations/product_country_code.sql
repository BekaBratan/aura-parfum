-- ============================================================
-- Store the country code alongside country_of_origin.
--
-- Previously the 2-letter code (e.g. "FR" for "Франция") was derived in code
-- via a fragile lookup map keyed by Russian name. Products with countries
-- not in the map (Saudi Arabia, for example — imported with the "original"
-- category) showed name without a code badge.
--
-- New column `country_code` stores the code per product. Display falls back
-- to the old map when the column is null (backwards-compatible).
--
-- Run AFTER country_of_origin.sql.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS country_code text;

-- Best-effort backfill from the known map (mirrors src/lib/countries.ts).
UPDATE public.products
SET country_code = CASE country_of_origin
  WHEN 'Турция'      THEN 'SL'
  WHEN 'Франция'     THEN 'FR'
  WHEN 'Швейцария'   THEN 'LZ'
  WHEN 'Испания'     THEN 'SP'
END
WHERE country_code IS NULL
  AND country_of_origin IN ('Турция', 'Франция', 'Швейцария', 'Испания');

-- Auto-link Saudi originals imported earlier (category = original).
UPDATE public.products
SET country_code = 'SA'
WHERE country_code IS NULL
  AND country_of_origin = 'Саудовская Аравия';
