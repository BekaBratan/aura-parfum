/**
 * Scan product-images bucket for oversized files and match them to product rows
 * so the admin can re-upload via the product edit form (re-upload will run the
 * client-side compressor and replace the file with a small WebP).
 *
 * Usage:
 *   node scripts/audit-product-images.js
 *   node scripts/audit-product-images.js --threshold 200  (KB; default 300)
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "product-images";
const FOLDER = "products";
const PAGE_SIZE = 1000;

const args = process.argv.slice(2);
const thresholdArgIdx = args.indexOf("--threshold");
const thresholdKb = thresholdArgIdx >= 0 ? Number(args[thresholdArgIdx + 1]) : 300;
const THRESHOLD_BYTES = thresholdKb * 1024;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function listAll() {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(FOLDER, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

(async () => {
  console.log(`Scanning bucket "${BUCKET}/${FOLDER}" — threshold ${thresholdKb} KB\n`);

  const files = await listAll();
  const sized = files
    .filter((f) => f.metadata && typeof f.metadata.size === "number")
    .map((f) => ({ name: f.name, size: f.metadata.size }));

  const oversized = sized.filter((f) => f.size > THRESHOLD_BYTES);

  console.log(`Total files: ${sized.length}`);
  console.log(`Oversized (> ${thresholdKb} KB): ${oversized.length}`);

  // ─── 1. Oversized files (full version too big) ─────────────────────────
  if (oversized.length > 0) {
    const publicUrls = oversized.map(
      (f) => supabase.storage.from(BUCKET).getPublicUrl(`${FOLDER}/${f.name}`).data.publicUrl
    );
    const { data: matched, error: prodErr } = await supabase
      .from("products")
      .select("id, name, brand, code, image_url")
      .in("image_url", publicUrls);
    if (prodErr) throw prodErr;
    const byUrl = new Map((matched ?? []).map((p) => [p.image_url, p]));

    console.log("\n── Oversized full images ──");
    oversized.sort((a, b) => b.size - a.size);
    for (const f of oversized) {
      const url = supabase.storage.from(BUCKET).getPublicUrl(`${FOLDER}/${f.name}`).data.publicUrl;
      const product = byUrl.get(url);
      const tag = product
        ? `${product.brand ? product.brand + " " : ""}${product.name}` +
          (product.code ? ` [${product.code}]` : "") +
          ` — id ${product.id}`
        : `(no product row points to this file)`;
      console.log(`${fmtSize(f.size).padStart(10)}  ${tag}`);
      console.log(`            ${url}`);
    }
  }

  // ─── 2. Products that lack a thumbnail (need re-upload to generate it) ─
  const { data: noThumb, error: thumbErr } = await supabase
    .from("products")
    .select("id, name, brand, code, image_url, image_thumb_url")
    .not("image_url", "is", null)
    .is("image_thumb_url", null);
  if (thumbErr) {
    // Column likely doesn't exist yet — silently skip this section
    if (!/image_thumb_url/.test(thumbErr.message)) throw thumbErr;
  } else {
    console.log(`\nProducts missing thumbnail: ${(noThumb ?? []).length}`);
    if ((noThumb ?? []).length > 0) {
      console.log("\n── Missing image_thumb_url ──");
      for (const p of noThumb) {
        const tag =
          `${p.brand ? p.brand + " " : ""}${p.name}` +
          (p.code ? ` [${p.code}]` : "") +
          ` — id ${p.id}`;
        console.log(`            ${tag}`);
      }
    }
  }

  if (oversized.length === 0 && (!noThumb || noThumb.length === 0)) {
    console.log("\nNothing to flag — all images are within budget and have thumbnails.");
    return;
  }

  console.log(
    `\nRe-upload each flagged product via /admin/products → edit → choose the same image.\n` +
      `The new upload generates two WebP variants client-side: full (800px, q=85) + thumb (400px, q=75).`
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
