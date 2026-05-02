-- Supabase Storage setup for Aura Parfum invoice PDFs.
-- Run this in the Supabase SQL Editor after supabase/schema.sql.
-- This does not change the orders table or invoice schema.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-pdfs',
  'invoice-pdfs',
  true,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read access for generated invoice PDF links.
drop policy if exists "invoice_pdfs_public_read" on storage.objects;
create policy "invoice_pdfs_public_read"
on storage.objects
for select
to public
using (bucket_id = 'invoice-pdfs');

-- Client uploads/updates for generated invoice PDFs.
-- The app writes files under invoices/{invoice_number}.pdf.
-- Guest checkout has no authenticated order owner, so this MVP allows public
-- writes only for PDFs in this bucket/folder. Keep the bucket file size and
-- MIME restrictions above, and tighten this later if invoices move server-side.
drop policy if exists "invoice_pdfs_client_insert" on storage.objects;
create policy "invoice_pdfs_client_insert"
on storage.objects
for insert
to public
with check (
  bucket_id = 'invoice-pdfs'
  and (storage.foldername(name))[1] = 'invoices'
  and lower(right(name, 4)) = '.pdf'
);

drop policy if exists "invoice_pdfs_client_update" on storage.objects;
create policy "invoice_pdfs_client_update"
on storage.objects
for update
to public
using (
  bucket_id = 'invoice-pdfs'
  and (storage.foldername(name))[1] = 'invoices'
  and lower(right(name, 4)) = '.pdf'
)
with check (
  bucket_id = 'invoice-pdfs'
  and (storage.foldername(name))[1] = 'invoices'
  and lower(right(name, 4)) = '.pdf'
);

-- Manual fallback:
-- 1. Create a public Storage bucket named invoice-pdfs in the Supabase dashboard.
-- 2. Set max file size to 10 MB and allowed MIME type to application/pdf.
-- 3. Keep public read enabled.
-- 4. Add insert/update policies for the invoices folder. For this client-side
--    MVP, public writes are required for guest invoice link generation.
