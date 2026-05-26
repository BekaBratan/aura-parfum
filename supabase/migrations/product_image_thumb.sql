-- ============================================================
-- Two-tier product images: pre-generated thumbnail alongside the full image.
--
-- The admin upload now produces:
--   * image_url        — full 800px WebP, ~q=85, used on the product detail page
--   * image_thumb_url  — thumb 400px WebP, ~q=75, used in catalog cards and cart
--
-- Both files are pre-compressed in the browser before upload, so no server- or
-- CDN-side transformation is needed. Pure pre-generation.
--
-- Run AFTER product_code.sql (no ordering with discount/ainur migrations).
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_thumb_url text;
