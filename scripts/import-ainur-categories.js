/**
 * Pull products from Ainur POS into Supabase under the new categories.
 *
 * Source → target mapping:
 *   * "Саудийский оригинал парфюм" → category 'original' (country = Саудовская Аравия)
 *   * "Премиум аналог европа"      → category 'analog'   (country = null)
 *   * "BIGHILL"                    → category 'analog'   (brand pinned to BIGHILL)
 *
 * Behaviour:
 *   * Default mode is dry-run — prints every product it WOULD insert without
 *     touching the DB.
 *   * Pass --apply to actually insert.
 *   * Skips products whose `ainur_id` already exists in Supabase (idempotent).
 *
 * Prices: stored AS-IS in `price_usd` (the column historically named "_usd"
 * but for KZT-priced categories it holds raw KZT — same quirk as accessory).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL + AINUR_POS_TOKEN
 * in .env.local.
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

const AINUR_BASE = "https://connect.ainur.app/api/v4";
const AINUR_TOKEN = process.env.AINUR_POS_TOKEN;
const AINUR_STORE_ID = process.env.AINUR_STORE_ID || "6689c95176d733b3f5060c00";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!AINUR_TOKEN) { console.error("AINUR_POS_TOKEN missing"); process.exit(1); }
if (!SUPABASE_URL) { console.error("NEXT_PUBLIC_SUPABASE_URL missing"); process.exit(1); }
if (!SUPABASE_SERVICE_KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const CATEGORY_RULES = [
  {
    matchCategoryName: "Саудийский оригинал парфюм",
    targetCategory: "original",
    country: "Саудовская Аравия",
    pinBrand: null,
  },
  {
    matchCategoryName: "Премиум аналог европа",
    targetCategory: "analog",
    country: null,
    pinBrand: null,
  },
  {
    matchCategoryName: "BIGHILL",
    targetCategory: "analog",
    country: null,
    pinBrand: "BIGHILL",
  },
];

async function ainurFetch(path, params = {}) {
  const url = new URL(AINUR_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { "X-AINUR-API-Access-Token": AINUR_TOKEN, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Ainur ${path} → ${res.status}`);
  return res.json();
}

// Strip noisy suffixes/prefixes so the cleaned name reads like a product title
function cleanName(raw) {
  let n = String(raw || "").trim();
  // strip leading "Аналог "
  n = n.replace(/^аналог\s+/i, "");
  // strip trailing volume markers "100 мл" / "200 ml" + optional "оригинал"
  n = n.replace(/\s*\d+\s*(мл|ml)\s*(оригинал)?\s*$/i, "");
  // strip standalone trailing "оригинал" (with optional closing paren)
  n = n.replace(/\s*оригинал\)?\s*$/i, "");
  // tidy double spaces
  return n.replace(/\s+/g, " ").trim();
}

// Best-effort brand guess: first word of the cleaned name, except for BIGHILL
// where the brand is pinned to "BIGHILL" and the rest becomes the product name.
function deriveBrandAndName(rawName, pinBrand) {
  const cleaned = cleanName(rawName);
  if (pinBrand) {
    // Drop a leading occurrence of the pinned brand from the name
    const stripped = cleaned.replace(new RegExp(`^${pinBrand}\\s+`, "i"), "");
    return { brand: pinBrand, name: stripped || cleaned };
  }
  const words = cleaned.split(" ");
  if (words.length <= 1) return { brand: cleaned, name: cleaned };
  return { brand: words[0], name: words.slice(1).join(" ") };
}

(async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writing to Supabase)" : "DRY-RUN (no DB writes)"}`);
  console.log(`Store: ${AINUR_STORE_ID}`);
  console.log("");

  // 1. Resolve Ainur category ids by name (trim for trailing-space mismatches)
  const categories = await ainurFetch("/product/ext-categories");
  const idByName = new Map(categories.map((c) => [String(c.name).trim().toLowerCase(), c.id]));
  for (const rule of CATEGORY_RULES) {
    rule.ainurCategoryId = idByName.get(rule.matchCategoryName.trim().toLowerCase()) || null;
    if (!rule.ainurCategoryId) {
      console.warn(`  ! Ainur category "${rule.matchCategoryName}" not found — skipping`);
    }
  }
  const rules = CATEGORY_RULES.filter((r) => r.ainurCategoryId);

  // 2. Pull all products and bucket them by rule
  const allProducts = await ainurFetch("/product", { limit: 1000, store_id: AINUR_STORE_ID });
  const grouped = new Map(rules.map((r) => [r.targetCategory + "::" + r.ainurCategoryId, { rule: r, items: [] }]));
  for (const p of allProducts) {
    for (const r of rules) {
      if (p.category_id === r.ainurCategoryId) {
        grouped.get(r.targetCategory + "::" + r.ainurCategoryId).items.push(p);
      }
    }
  }

  // 3. Fetch existing ainur_ids from Supabase so we skip duplicates
  const { data: existing } = await supabase
    .from("products")
    .select("ainur_id")
    .not("ainur_id", "is", null);
  const existingIds = new Set((existing ?? []).map((r) => r.ainur_id));
  console.log(`Already linked in Supabase: ${existingIds.size} ainur_id(s)`);
  console.log("");

  // 4. Process each bucket
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const { rule, items } of grouped.values()) {
    console.log(`=== ${rule.matchCategoryName} → category "${rule.targetCategory}" (${items.length} found) ===`);
    let inserted = 0;
    let skipped = 0;
    for (const p of items) {
      if (existingIds.has(p.id)) {
        skipped += 1;
        if (VERBOSE) console.log(`  skip (already linked): ${p.options?.name}`);
        continue;
      }

      const { brand, name } = deriveBrandAndName(p.options?.name, rule.pinBrand);
      const stock = Number(p.stock?.[AINUR_STORE_ID] ?? 0);
      const price = Number(p.price ?? 0);

      const row = {
        name,
        brand,
        description: null,
        gender: "unisex",
        volume_ml: null,
        image_url: null,
        image_thumb_url: null,
        count: Number.isFinite(stock) && stock > 0 ? stock : 0,
        is_featured: false,
        category: rule.targetCategory,
        unit: "pcs",
        min_volume: null,
        attributes: { gender: "unisex" },
        country_of_origin: rule.country,
        price_usd: price,         // raw KZT for these categories
        ainur_id: p.id,
        code: (p.code ?? p.plu_code ?? "").toString().trim() || null,
      };

      console.log(`  + [${rule.targetCategory}] ${brand ? brand + " " : ""}${name}` +
                  ` · ₸${price.toLocaleString("ru-RU")} · stock=${stock} · ainur_id=${p.id}`);

      if (APPLY) {
        const { error } = await supabase.from("products").insert(row);
        if (error) {
          console.error(`    ! insert failed: ${error.message}`);
          totalErrors += 1;
        } else {
          inserted += 1;
        }
      } else {
        inserted += 1; // counted as "would insert"
      }
    }
    console.log(`  → ${APPLY ? "inserted" : "would insert"}: ${inserted}, skipped: ${skipped}`);
    console.log("");
    totalInserted += inserted;
    totalSkipped += skipped;
  }

  console.log("===========");
  console.log(`Total: ${APPLY ? "inserted" : "would insert"} ${totalInserted}, skipped ${totalSkipped}, errors ${totalErrors}`);
  if (!APPLY) {
    console.log("");
    console.log("Re-run with --apply to actually insert into Supabase.");
  }
})().catch((err) => {
  console.error("Import failed:", err);
  process.exit(2);
});
