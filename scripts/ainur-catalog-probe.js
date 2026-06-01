/**
 * Read-only probe of the Ainur POS catalog.
 *
 * Lists every category with product count and stock, plus searches product
 * names for the keywords "оригинал" / "аналог" / "original" / "analog" so we
 * can see how Ainur distinguishes them (separate categories? naming convention?
 * tags? variations?).
 *
 * Usage:
 *   node scripts/ainur-catalog-probe.js
 *
 * Requires AINUR_POS_TOKEN in .env.local. Makes only GET requests — never modifies anything.
 */

require("dotenv").config({ path: ".env.local" });

const BASE_URL = "https://connect.ainur.app/api/v4";
const TOKEN = process.env.AINUR_POS_TOKEN;
const STORE_ID = process.env.AINUR_STORE_ID || "6689c95176d733b3f5060c00";

if (!TOKEN) {
  console.error("AINUR_POS_TOKEN is not set in .env.local");
  process.exit(1);
}

async function ainurFetch(path, params = {}) {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      "X-AINUR-API-Access-Token": TOKEN,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path} → ${res.status} ${res.statusText} :: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function fmt(n) {
  return Number(n || 0).toLocaleString("ru-RU");
}

(async function main() {
  console.log(`STORE_ID = ${STORE_ID}`);
  console.log("");

  // 1. Categories tree
  const categories = await ainurFetch("/product/ext-categories");
  const byId = new Map(categories.map((c) => [c.id, c]));
  console.log(`Found ${categories.length} categories.`);
  console.log("");

  // 2. Products — paginate just in case Ainur caps at 1000
  let products = [];
  let offset = 0;
  const LIMIT = 1000;
  while (true) {
    const batch = await ainurFetch("/product", {
      limit: LIMIT,
      offset,
      store_id: STORE_ID,
    });
    products = products.concat(batch);
    if (batch.length < LIMIT) break;
    offset += LIMIT;
    if (offset > 5000) break; // safety
  }
  console.log(`Total products fetched: ${products.length}`);
  console.log("");

  // 3. Category breakdown — count + stock per category
  const catStats = new Map();
  for (const p of products) {
    const id = p.category_id ?? "__no_category__";
    const s = catStats.get(id) || { count: 0, inStock: 0, totalStock: 0, samples: [] };
    s.count += 1;
    const stock = Number(p.stock?.[STORE_ID] ?? 0);
    s.totalStock += stock;
    if (stock > 0) s.inStock += 1;
    if (s.samples.length < 4) s.samples.push((p.options?.name ?? "").trim());
    catStats.set(id, s);
  }

  console.log("=== Categories with products ===");
  const rows = [];
  for (const [id, s] of catStats.entries()) {
    const cat = byId.get(id);
    const name = id === "__no_category__" ? "(без категории)" : (cat?.name ?? `[unknown id ${id}]`);
    const parent = cat?.parent_id ? (byId.get(cat.parent_id)?.name ?? "?") : "—";
    rows.push({ name, parent, count: s.count, inStock: s.inStock, stock: s.totalStock, samples: s.samples });
  }
  rows.sort((a, b) => b.count - a.count);
  for (const r of rows) {
    console.log(
      `  ${r.name.padEnd(40)} parent=${r.parent.padEnd(20)} products=${String(r.count).padStart(4)} ` +
      `(in_stock=${r.inStock}, total_stock=${fmt(r.stock)})`,
    );
    if (r.samples.length) {
      console.log(`    e.g. ${r.samples.slice(0, 3).map((s) => `"${s}"`).join(", ")}`);
    }
  }
  console.log("");

  // 4. Keyword hunt — original / analog variants
  const keywords = ["оригинал", "ориг", "original", "аналог", "analog", "копия", "версия"];
  const matchesByKw = Object.fromEntries(keywords.map((k) => [k, []]));
  for (const p of products) {
    const name = (p.options?.name ?? "").toLowerCase();
    for (const kw of keywords) {
      if (name.includes(kw)) {
        matchesByKw[kw].push({
          name: p.options?.name,
          category: byId.get(p.category_id ?? "")?.name ?? "(none)",
          price: p.price,
          stock: p.stock?.[STORE_ID] ?? 0,
        });
        break; // count once
      }
    }
  }
  console.log("=== Keyword matches in product names ===");
  for (const [kw, hits] of Object.entries(matchesByKw)) {
    if (!hits.length) continue;
    console.log(`  "${kw}" → ${hits.length} hit(s):`);
    for (const h of hits.slice(0, 10)) {
      console.log(`    [${h.category}] ${h.name} · price=${fmt(h.price)} · stock=${h.stock}`);
    }
    if (hits.length > 10) console.log(`    ... +${hits.length - 10} more`);
  }
  console.log("");

  // 5. Price distribution per category — useful for the KZT-only switch decision
  console.log("=== Price ranges per category ===");
  const priceByCat = new Map();
  for (const p of products) {
    const id = p.category_id ?? "__no_category__";
    const arr = priceByCat.get(id) || [];
    arr.push(Number(p.price ?? 0));
    priceByCat.set(id, arr);
  }
  for (const [id, prices] of priceByCat.entries()) {
    const cat = byId.get(id);
    const name = id === "__no_category__" ? "(без категории)" : (cat?.name ?? id);
    const sorted = prices.filter((n) => n > 0).sort((a, b) => a - b);
    if (!sorted.length) continue;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(`  ${name.padEnd(40)} min=${fmt(min).padStart(8)} median=${fmt(median).padStart(8)} max=${fmt(max).padStart(8)}`);
  }
})().catch((err) => {
  console.error("Probe failed:", err.message);
  process.exit(2);
});
