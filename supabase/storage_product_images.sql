-- Supabase Storage setup for Aura Parfum product images.
-- Run this in the Supabase SQL Editor after supabase/schema.sql.
-- It does not change the products table; product URLs continue to be stored in products.image_url.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read access for product images.
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'product-images');

-- Admin-only writes. These policies rely on public.has_role(user_id, role)
-- from supabase/schema.sql. If your project uses a different admin role
-- function, replace public.has_role(auth.uid(), 'admin') with that check.
drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'products'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'products'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'products'
  and public.has_role(auth.uid(), 'admin')
);

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'products'
  and public.has_role(auth.uid(), 'admin')
);

-- Manual fallback if the role check is hard to adapt:
-- 1. Create a public Storage bucket named product-images in the Supabase dashboard.
-- 2. Set max file size to 5 MB and allowed MIME types to image/jpeg, image/png, image/webp.
-- 3. Keep public read enabled.
-- 4. Add equivalent authenticated write policies once your admin role check is available.
-- The app only renders upload/change controls for admins, but production Storage writes
-- should still be protected by Storage policies.
