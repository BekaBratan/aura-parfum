/**
 * Import accessories from AZ-ZAHRA(Аксессуары).xlsx into Supabase.
 *
 * Usage:
 *   node scripts/import-accessories.js
 *   node scripts/import-accessories.js --dry-run
 *
 * Images: put files in images/ folder with the same name as the product
 * (e.g. "2мл ролик.jpg"). Any extension works: jpg, jpeg, png, webp.
 */

require("dotenv").config({ path: ".env.local" });
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const AdmZip = require("adm-zip");

const FILE = "excels/AZ-ZAHRA(Аксессуары).xlsx";
const BUCKET = "product-images";
const HEADER_ROW = 2; // 0-indexed

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  Missing env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function mimeFromExt(ext) {
  return { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[ext.toLowerCase()] || "image/jpeg";
}

// Extract row->imageBuffer map from Excel zip
function extractImagesFromExcel() {
  const zip = new AdmZip(FILE);
  const drawing = zip.readAsText("xl/drawings/drawing1.xml");
  const rels    = zip.readAsText("xl/drawings/_rels/drawing1.xml.rels");

  const relMap = Object.fromEntries(
    [...rels.matchAll(/Id="(rId\d+)"[^>]+Target="\.\.\/media\/(image\d+\.\w+)"/g)]
      .map(m => [m[1], m[2]])
  );

  const rowToImage = {};
  for (const m of drawing.matchAll(/<xdr:oneCellAnchor>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?r:embed="(rId\d+)"[\s\S]*?<\/xdr:oneCellAnchor>/g)) {
    const row = parseInt(m[1]);
    const file = relMap[m[2]];
    if (file && !rowToImage[row]) {
      const buf = zip.readFile(`xl/media/${file}`);
      const ext = path.extname(file);
      rowToImage[row] = { buf, ext, filename: file };
    }
  }
  return rowToImage;
}

async function uploadImageBuffer(buf, ext, name) {
  const slug = name.toLowerCase().replace(/[^\w]/g, "-").replace(/-+/g, "-").slice(0, 60);
  const storagePath = `products/${slug}-${Date.now()}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: mimeFromExt(ext), upsert: false });

  if (error) { console.warn(`  ⚠️  Upload failed: ${error.message}`); return null; }
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function main() {
  if (DRY_RUN) console.log("🔍  DRY RUN\n");

  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets["Лист1"];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Extract embedded images from Excel zip: row(0-based) -> {buf, ext}
  const rowToImage = extractImagesFromExcel();

  let inserted = 0, skipped = 0, noImage = 0;

  for (let i = HEADER_ROW + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;

    const rawName     = String(r[0]).replace(/\n/g, " ").trim();
    const priceKzt    = parseFloat(r[2]) || 0;
    const type        = String(r[3] || "").trim();
    const description = String(r[4] || "").trim() || null;
    const stock       = parseInt(r[5]) || 500;
    const imgData     = rowToImage[i]; // i is the 0-based row index

    if (!rawName) { skipped++; continue; }

    const priceUsd = priceKzt; // stored as raw KZT in price_usd for accessories

    console.log(`row ${i + 1}: ${rawName} | ${type} | ${priceKzt}₸ | img: ${imgData ? "✓ " + imgData.filename : "✗"}`);
    if (!imgData) noImage++;

    if (DRY_RUN) { inserted++; continue; }

    const imageUrl = imgData ? await uploadImageBuffer(imgData.buf, imgData.ext, rawName) : null;

    const { error } = await supabase.from("products").insert({
      name: rawName,
      brand: "AZ-ZAHRA",
      description,
      price_usd: priceUsd,
      gender: "unisex",
      volume_ml: null,
      image_url: imageUrl,
      count: stock,
      is_featured: false,
      category: "accessory",
      unit: "pcs",
      min_volume: null,
      attributes: type ? { type } : {},
      country_of_origin: null,
    });

    if (error) { console.error(`  ❌  ${error.message}`); }
    else inserted++;

    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(`\n✅  Добавлено: ${inserted} | Пропущено: ${skipped} | Без картинки: ${noImage}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
