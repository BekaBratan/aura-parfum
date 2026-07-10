-- ============================================================
-- Add kzt_rate column to orders table
-- Stores the exchange rate at the moment of order creation so
-- that invoices/PDFs use the original rate, not the current one.
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kzt_rate numeric(18,6);

-- Backfill kzt_rate for old orders from their USD/KZT totals
UPDATE public.orders
SET kzt_rate = ROUND(total_display_currency::numeric / NULLIF(total_usd, 0), 6)
WHERE kzt_rate IS NULL AND total_usd > 0;
