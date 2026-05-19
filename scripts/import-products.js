/**
 * Import products from Excel into Supabase.
 *
 * Usage:
 *   node scripts/import-products.js                  — all sheets
 *   node scripts/import-products.js --sheet=Женские  — one sheet
 *   node scripts/import-products.js --dry-run        — preview, no writes
 */

require("dotenv").config({ path: ".env.local" });
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SHEET_ARG = (args.find((a) => a.startsWith("--sheet=")) || "").replace("--sheet=", "");

// ─── Config ───────────────────────────────────────────────────────────────────

const EXCEL_FILE = (args.find((a) => a.startsWith("--file=")) || "").replace("--file=", "") || "excels/AZ-ZAHRA(Парфюм).xlsx";
const BUCKET = "product-images";
const HEADER_ROW = 3;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SHEET_GENDER = { "Мужские": "men", "Женские": "women", "Уни": "unisex" };

function cleanName(raw) {
  return raw.trim();
}

function mimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[ext] || "application/octet-stream";
}

async function uploadImage(localPath) {
  if (!localPath) return null;
  // Try both straight apostrophe (') and Unicode right quote (')
  const candidates = [localPath, localPath.replace(/'/g, "’"), localPath.replace(/’/g, "'")];
  const resolvedPath = candidates.find(p => fs.existsSync(p));
  if (!resolvedPath) return null;
  localPath = resolvedPath;

  const fileBuffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath);
  const baseName = path.basename(localPath, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  const storagePath = `products/${baseName}-${Date.now()}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType: mimeFromPath(localPath), upsert: false });

  if (error) {
    console.warn(`  ⚠️  Image upload failed (${path.basename(localPath)}): ${error.message}`);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function importSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.warn(`Sheet "${sheetName}" not found`); return; }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const gender = SHEET_GENDER[sheetName] || "unisex";

  let inserted = 0, skipped = 0, errors = 0;

  for (let i = HEADER_ROW + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue; // empty row

    const rawName    = String(row[0] || "").trim();
    const quality    = String(row[1] || "").trim();   // De Luxe / Premium
    const priceUsd   = parseFloat(row[3]) || 0;
    const brand      = String(row[4] || "").trim();
    const description = String(row[5] || "").trim() || null;
    const stock      = parseInt(row[6]) || 500;
    const country    = String(row[7] || "").trim() || null;
    const imagePath  = String(row[8] || "").trim();

    if (!rawName || !brand) { skipped++; continue; }

    const name = cleanName(rawName);

    console.log(`[${sheetName}] row ${i + 1}: ${name} (${brand})`);

    if (DRY_RUN) { inserted++; continue; }

    // Upload image
    const imageUrl = await uploadImage(imagePath);

    // Build product payload
    const payload = {
      name,
      brand,
      description,
      price_usd: priceUsd,
      gender,
      volume_ml: null,
      image_url: imageUrl,
      count: stock,
      is_featured: false,
      category: EXCEL_FILE.includes("Масло") ? "oil" : "perfume",
      unit: "ml",
      min_volume: 1,
      attributes: { gender, ...(quality ? { quality } : {}) },
      country_of_origin: country || null,
    };

    const { error } = await supabase.from("products").insert(payload);

    if (error) {
      console.error(`  ❌  Insert failed: ${error.message}`);
      errors++;
    } else {
      inserted++;
    }

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n✅  ${sheetName}: ${inserted} добавлено, ${skipped} пропущено, ${errors} ошибок\n`);
}

async function main() {
  const wb = XLSX.readFile(EXCEL_FILE);
  const sheets = SHEET_ARG ? [SHEET_ARG] : wb.SheetNames;

  if (DRY_RUN) console.log("🔍  DRY RUN — в базу ничего не пишется\n");

  for (const sheet of sheets) {
    await importSheet(wb, sheet);
  }

  console.log("Готово.");
}

main().catch((err) => { console.error(err); process.exit(1); });
