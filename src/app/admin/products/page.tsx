"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Link2, Link2Off, Loader2, Pencil, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import toast from "react-hot-toast";
import { useAdminRole } from "@/lib/adminRole";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS, UNIT_LABELS, GENDER_LABELS, isKztPriced } from "@/lib/utils";
import { formatKzt, convertToKzt } from "@/lib/currency";
import { Product, ProductCategory } from "@/types";
import Pagination from "@/components/ui/Pagination";
import { COUNTRIES as FALLBACK_COUNTRIES } from "@/lib/countries";
import { useCurrencyStore } from "@/store/currencyStore";
import AinurPicker from "@/components/admin/AinurPicker";
import type { AdminAinurProduct } from "@/app/api/admin/ainur-products/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  brand: string;
  description: string;
  price: string;
  category: ProductCategory;
  volume_ml: string;
  min_volume: string;
  image_url: string;
  image_thumb_url: string;
  count: string;
  is_featured: boolean;
  attributes: Record<string, string>;
  country_of_origin: string;
  code: string;
  ainur_id: string | null;
  ainur_name: string | null;
}

const emptyProduct: FormState = {
  name: "",
  brand: "",
  description: "",
  price: "",
  category: "perfume",
  volume_ml: "",
  min_volume: "50",
  image_url: "",
  image_thumb_url: "",
  count: "",
  is_featured: false,
  attributes: {},
  country_of_origin: "",
  code: "",
  ainur_id: null,
  ainur_name: null,
};

// ─── Category-specific attribute field configs ─────────────────────────────

type AttrField = { key: string; label: string; placeholder: string };

const CATEGORY_ATTR_FIELDS: Record<ProductCategory, AttrField[]> = {
  oil: [
    { key: "gender",  label: "Пол",      placeholder: "" },
    { key: "quality", label: "Качество", placeholder: "" },
  ],
  perfume: [
    { key: "gender",  label: "Пол",      placeholder: "" },
    { key: "quality", label: "Качество", placeholder: "" },
  ],
  original: [
    { key: "gender",  label: "Пол",      placeholder: "" },
    { key: "quality", label: "Качество", placeholder: "" },
  ],
  analog: [
    { key: "gender",  label: "Пол",      placeholder: "" },
    { key: "quality", label: "Качество", placeholder: "" },
  ],
  accessory: [
    { key: "type", label: "Тип аксессуара", placeholder: "флакон, воронка, браслет..." },
  ],
};

const GENDER_OPTIONS = [
  { value: "unisex", label: "Унисекс" },
  { value: "men",    label: "Мужской" },
  { value: "women",  label: "Женский" },
];

const DEFAULT_QUALITY_OPTIONS = ["De Luxe", "Premium"];

// ─── Image helpers ─────────────────────────────────────────────────────────

const PRODUCT_IMAGE_BUCKET = "product-images";
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function generatedUploadId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function getImageExtension(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ALLOWED_IMAGE_EXTENSIONS.has(ext)) return ext;
  return MIME_TYPE_EXTENSIONS[file.type] || null;
}

function validateImageFile(file: File) {
  const extension = getImageExtension(file);
  if (!extension || (file.type && !ALLOWED_IMAGE_MIME_TYPES.has(file.type)))
    return "Можно загружать только JPG, JPEG, PNG или WEBP";
  if (file.size > MAX_IMAGE_SIZE_BYTES) return "Размер изображения не должен превышать 5 МБ";
  return null;
}

function slugifyUploadName(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || generatedUploadId();
}

function createUploadPath(file: File, form: FormState, productId: string | null) {
  const extension = getImageExtension(file) || "jpg";
  const baseName = productId || slugifyUploadName(`${form.brand}-${form.name}`);
  return `products/${baseName}-${Date.now()}.${extension}`;
}

// Compress an admin-uploaded product image to a WebP variant. Two variants are
// produced per upload (see uploadSelectedImage) — `full` for the product page,
// `thumb` for catalog cards / cart. All compression runs in the browser via
// browser-image-compression; no server- or CDN-side transformation is used
// (Vercel image opt is disabled and Supabase transforms require Pro).
async function compressProductImage(
  file: File,
  opts: { maxWidthOrHeight: number; initialQuality: number; maxSizeMB: number; nameSuffix: string },
): Promise<File> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: opts.maxSizeMB,
      maxWidthOrHeight: opts.maxWidthOrHeight,
      initialQuality: opts.initialQuality,
      fileType: "image/webp",
      useWebWorker: true,
    });
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([compressed], `${baseName}${opts.nameSuffix}.webp`, { type: "image/webp" });
  } catch (error) {
    console.error(`Image compression failed (${opts.nameSuffix || "full"}), uploading original`, error);
    return file;
  }
}

// Allow any decimal input for price (e.g. "2.50")
function normalizeDecimalInput(value: string): string {
  // Keep digits and at most one decimal point
  const cleaned = value.replace(/[^0-9.]/g, "").replace(/(\.\d*)\./g, "$1");
  return cleaned;
}

// Allow integer-only input; just strip non-digits, allow empty
function normalizeIntInput(value: string): string {
  return value.replace(/\D/g, "");
}

// ─── Thumbnail component ───────────────────────────────────────────────────

function ProductThumbnail({ product }: { product: Product }) {
  const [imageError, setImageError] = useState(false);
  useEffect(() => setImageError(false), [product.image_url]);
  return (
    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--dark-3)] relative">
      {product.image_url && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image_thumb_url ?? product.image_url ?? ""} alt="" loading="lazy" decoding="async" className="product-thumb-img" onError={() => setImageError(true)} />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[var(--gold-dark)]">
          <ImageIcon size={16} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function AdminProducts() {
  const { role } = useAdminRole();
  const isAdmin = role === "admin";
  const kztRate = useCurrencyStore((s) => s.kztRate);

  const [countries, setCountries] = useState<string[]>(FALLBACK_COUNTRIES);
  const [qualityOptions, setQualityOptions] = useState<string[]>(DEFAULT_QUALITY_OPTIONS);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyProduct);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [previewImageError, setPreviewImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [ainurPickerOpen, setAinurPickerOpen] = useState(false);
  const [ainurStockById, setAinurStockById] = useState<Record<string, number>>({});

  // ─── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<ProductCategory | "all">("all");
  const [filterStock, setFilterStock] = useState<"all" | "in" | "out">("all");
  const [filterQuality, setFilterQuality] = useState<"all" | "deluxe" | "premium">("all");
  const [filterAccessoryType, setFilterAccessoryType] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [filterAinurLink, setFilterAinurLink] = useState<"all" | "linked" | "unlinked" | "stale">("all");
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [showAllAccessoryTypes, setShowAllAccessoryTypes] = useState(false);
  const ADMIN_FILTER_LIMIT = 6;
  const [adminPage, setAdminPage] = useState(1);
  const ADMIN_PAGE_SIZE = 20;

  const resetPage = () => setAdminPage(1);

  // Dynamic options from current category
  const catProducts = useMemo(
    () => filterCategory === "all" ? products : products.filter((p) => p.category === filterCategory),
    [products, filterCategory]
  );

  const accessoryTypes = useMemo(() => {
    const types = products
      .filter((p) => p.category === "accessory" && p.attributes?.type)
      .map((p) => String(p.attributes.type));
    return [...new Set(types)].sort();
  }, [products]);

  const availableCountries = useMemo(() => {
    const c = catProducts
      .map((p) => p.country_of_origin)
      .filter((c): c is string => Boolean(c));
    return [...new Set(c)].sort();
  }, [catProducts]);

  const hasProductsWithoutCountry = useMemo(
    () => catProducts.some((p) => !p.country_of_origin),
    [catProducts]
  );

  const availableGenders = useMemo(() => {
    const g = catProducts
      .map((p) => (p.attributes?.["gender"] as string | undefined) ?? p.gender)
      .filter(Boolean) as string[];
    return ["men", "women", "unisex"].filter((v) => g.includes(v));
  }, [catProducts]);

  const hasProductsWithoutGender = useMemo(
    () => catProducts.some((p) => {
      const g = (p.attributes?.["gender"] as string | undefined) ?? p.gender;
      return !g;
    }),
    [catProducts]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      // Stock filter uses the effective count (Ainur if linked, Supabase otherwise)
      const effectiveCount = p.ainur_id && p.ainur_id in ainurStockById
        ? ainurStockById[p.ainur_id]
        : Number(p.count ?? 0);
      if (filterStock === "in" && effectiveCount === 0) return false;
      if (filterStock === "out" && effectiveCount > 0) return false;
      if (filterCategory !== "accessory") {
        if (filterQuality === "deluxe" && p.attributes?.quality !== "De Luxe") return false;
        if (filterQuality === "premium" && p.attributes?.quality !== "Premium") return false;
      }
      if (filterCategory === "accessory" && filterAccessoryType !== "all") {
        if (String(p.attributes?.type ?? "") !== filterAccessoryType) return false;
      }
      if (filterGender !== "all") {
        const g = (p.attributes?.["gender"] as string | undefined) ?? p.gender;
        if (filterGender === "__empty__" ? Boolean(g) : g !== filterGender) return false;
      }
      if (filterCountry !== "all") {
        if (filterCountry === "__empty__" ? Boolean(p.country_of_origin) : p.country_of_origin !== filterCountry) return false;
      }
      if (filterFeatured && !p.is_featured) return false;
      if (filterAinurLink === "linked" && !(p.ainur_id && p.ainur_id in ainurStockById)) return false;
      if (filterAinurLink === "unlinked" && p.ainur_id) return false;
      if (filterAinurLink === "stale" && !(p.ainur_id && !(p.ainur_id in ainurStockById))) return false;
      if (search) {
        const q = search.toLowerCase();
        const code = (p.code ?? "").toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.brand.toLowerCase().includes(q) &&
          !code.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [products, search, filterCategory, filterStock, filterQuality, filterAccessoryType, filterGender, filterCountry, filterFeatured, filterAinurLink, ainurStockById]);

  const supabase = createClient();
  const imagePreviewSrc = selectedImagePreviewUrl || form.image_url.trim();
  // Oil and perfume are sold per ml; accessory / original / analog are pcs (KZT-priced).
  const isMl = !isKztPriced(form.category);

  const resetSelectedImage = () => {
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl(null);
    setPreviewImageError(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeModal = () => {
    resetSelectedImage();
    setModalOpen(false);
  };

  async function loadProducts() {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts((data as Product[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    void loadProducts();
    fetch("/api/admin/options").then(async (r) => {
      if (!r.ok) return;
      const opts: { type: string; value: string }[] = await r.json();
      const c = opts.filter((o) => o.type === "country").map((o) => o.value).sort();
      const q = opts.filter((o) => o.type === "quality").map((o) => o.value);
      if (c.length) setCountries(c);
      if (q.length) setQualityOptions(q);
    }).catch(() => {});

    // Pull Ainur stock map once so the admin table can show live counts
    fetch("/api/admin/ainur-products").then(async (r) => {
      if (!r.ok) return;
      const json = (await r.json()) as { data?: AdminAinurProduct[] };
      if (!json.data) return;
      const map: Record<string, number> = {};
      for (const p of json.data) map[p.id] = p.stock;
      setAinurStockById(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => { if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl); };
  }, [selectedImagePreviewUrl]);

  useEffect(() => setPreviewImageError(false), [selectedImagePreviewUrl, form.image_url]);

  const openNew = () => {
    if (!isAdmin) return;
    setEditId(null);
    setForm(emptyProduct);
    resetSelectedImage();
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    if (!isAdmin) return;
    setEditId(product.id);
    const editCategory = product.category ?? "perfume";
    const editKzt = isKztPriced(editCategory);
    setForm({
      name: product.name,
      brand: product.brand,
      description: product.description || "",
      price: editKzt
        ? String(Math.round(Number(product.price_usd)))
        : String(product.price_usd ?? ""),
      category: product.category ?? "perfume",
      volume_ml: product.volume_ml === null ? "" : String(product.volume_ml),
      min_volume: product.min_volume === null ? "" : String(product.min_volume),
      image_url: product.image_url || "",
      image_thumb_url: product.image_thumb_url ?? "",
      count: String(product.count ?? 0),
      is_featured: product.is_featured,
      country_of_origin: product.country_of_origin ?? "",
      code: product.code ?? "",
      ainur_id: product.ainur_id ?? null,
      ainur_name: null, // resolved by the picker / displayed only after re-pick
      attributes: Object.fromEntries(
        Object.entries(product.attributes ?? {}).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(", ") : String(v ?? ""),
        ])
      ),
    });
    resetSelectedImage();
    setModalOpen(true);
  };

  // Memoized set of ainur_ids already linked to *other* Supabase products,
  // so the picker can mark them as taken.
  const takenAinurIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of products) {
      if (p.ainur_id && p.id !== editId) ids.add(p.ainur_id);
    }
    return ids;
  }, [products, editId]);

  const handleAinurPick = (a: AdminAinurProduct) => {
    setForm((prev) => ({
      ...prev,
      ainur_id: a.id,
      ainur_name: a.name,
      // Prefill name/code/price/count for new products if the operator hasn't typed anything yet
      name: prev.name || a.name,
      code: prev.code || a.code,
      price: prev.price || (isKztPriced(prev.category) ? String(Math.round(a.price)) : prev.price),
      count: prev.count || String(a.stock),
    }));
    setAinurPickerOpen(false);
  };

  const handleAinurClear = () => {
    setForm((prev) => ({ ...prev, ainur_id: null, ainur_name: null }));
  };

  const uploadSelectedImage = async () => {
    if (!selectedImageFile) return null;

    // Generate full (800px / q=85) and thumb (400px / q=75) WebP variants
    // in parallel so they share the same timestamp in the path.
    const [fullFile, thumbFile] = await Promise.all([
      compressProductImage(selectedImageFile, {
        maxWidthOrHeight: 800, initialQuality: 0.85, maxSizeMB: 0.3, nameSuffix: "",
      }),
      compressProductImage(selectedImageFile, {
        maxWidthOrHeight: 400, initialQuality: 0.75, maxSizeMB: 0.1, nameSuffix: "-thumb",
      }),
    ]);

    const fullPath = createUploadPath(fullFile, form, editId);
    const thumbPath = fullPath.replace(/(\.[^.]+)$/, "-thumb$1");

    const bucket = supabase.storage.from(PRODUCT_IMAGE_BUCKET);
    const opts = { cacheControl: "3600", upsert: false };

    const fullRes = await bucket.upload(fullPath, fullFile, { ...opts, contentType: fullFile.type || undefined });
    if (fullRes.error) throw fullRes.error;

    const thumbRes = await bucket.upload(thumbPath, thumbFile, { ...opts, contentType: thumbFile.type || undefined });
    if (thumbRes.error) {
      await bucket.remove([fullPath]);
      throw thumbRes.error;
    }

    return {
      fullPath,
      thumbPath,
      publicUrl: bucket.getPublicUrl(fullPath).data.publicUrl,
      thumbPublicUrl: bucket.getPublicUrl(thumbPath).data.publicUrl,
    };
  };

  const handleSave = async () => {
    if (!isAdmin) return;

    if (!form.name) { toast.error("Заполните название товара"); return; }
    if (!form.brand && form.category !== "accessory") { toast.error("Заполните бренд"); return; }
    if (form.price === "") { toast.error("Укажите цену товара"); return; }
    const priceInput = Number(form.price);
    if (priceInput <= 0) { toast.error("Цена должна быть больше 0"); return; }
    // For accessories price is entered in KZT — convert to USD for storage
    const price = priceInput;
    if (form.count === "") { toast.error("Укажите количество товара"); return; }
    const count = Math.floor(Number(form.count));
    if (count < 0) { toast.error("Количество не может быть отрицательным"); return; }

    const volumeMl = form.volume_ml === "" ? null : Number(form.volume_ml);
    if (volumeMl !== null && volumeMl <= 0) { toast.error("Объем должен быть больше 0"); return; }

    const minVolume = form.min_volume === "" ? null : Number(form.min_volume);
    if (minVolume !== null && minVolume <= 0) { toast.error("Минимальный объём должен быть больше 0"); return; }

    setSaving(true);
    const uploadedPaths: string[] = [];

    try {
      const uploadedImage = await uploadSelectedImage();
      if (uploadedImage) {
        uploadedPaths.push(uploadedImage.fullPath, uploadedImage.thumbPath);
      }
      const imageUrl = uploadedImage?.publicUrl || form.image_url || null;
      const imageThumbUrl = uploadedImage?.thumbPublicUrl
        || (uploadedImage ? null : form.image_thumb_url || null);

      const unit = isKztPriced(form.category) ? "pcs" : "ml";

      // Build attributes object
      const attrs: Record<string, string> = {};
      for (const { key } of CATEGORY_ATTR_FIELDS[form.category]) {
        const val = form.attributes[key]?.trim();
        if (val) attrs[key] = val;
      }

      // Derive gender for DB column — oil and perfume both use gender attribute
      const genderVal = (form.category === "perfume" || form.category === "oil")
        ? ((form.attributes["gender"] ?? "unisex") as "men" | "women" | "unisex")
        : "unisex";

      // Build payload progressively — strip columns that don't exist yet (pre-migration fallback)
      type ProductPayload = Record<string, unknown>;

      const save = async (payload: ProductPayload): Promise<string | null> => {
        if (editId) {
          const { error } = await supabase.from("products").update(payload).eq("id", editId);
          return error?.message || null;
        }
        const { error } = await supabase.from("products").insert(payload);
        return error?.message || null;
      };

      // Start with all known columns
      let payload: ProductPayload = {
        name: form.name,
        brand: form.brand,
        description: form.description || null,
        gender: genderVal,
        volume_ml: volumeMl,
        image_url: imageUrl,
        image_thumb_url: imageThumbUrl,
        count,
        is_featured: form.is_featured,
        category: form.category,
        unit,
        min_volume: minVolume,
        attributes: attrs,
        country_of_origin: (form.category !== "accessory" && form.country_of_origin)
          ? form.country_of_origin
          : null,
        price_usd: price,
        ainur_id: form.ainur_id || null,
        code: form.code.trim() || null,
      };

      let saveError = await save(payload);

      // Graceful fallbacks for columns that may not exist if migrations haven't been run yet
      if (saveError?.includes("ainur_id")) {
        const { ainur_id, ...rest } = payload;
        payload = rest;
        toast.error("Колонка ainur_id ещё не создана. Запустите supabase/migrations/ainur_id.sql");
        saveError = await save(payload);
      }
      if (saveError?.includes("\"code\"") || saveError?.match(/column .*code.* does not exist/i)) {
        const { code, ...rest } = payload;
        payload = rest;
        toast.error("Колонка code ещё не создана. Запустите supabase/migrations/product_code.sql");
        saveError = await save(payload);
      }
      if (saveError?.includes("price_usd")) {
        const { price_usd, ...rest } = payload;
        payload = { ...rest, price: price_usd };
        saveError = await save(payload);
      }
      if (saveError?.includes("country_of_origin")) {
        const { country_of_origin, ...rest } = payload;
        payload = rest;
        saveError = await save(payload);
      }
      if (saveError?.includes("image_thumb_url")) {
        const { image_thumb_url, ...rest } = payload;
        payload = rest;
        toast.error("Колонка image_thumb_url ещё не создана. Запустите supabase/migrations/product_image_thumb.sql");
        saveError = await save(payload);
      }
      if (saveError?.includes("category") || saveError?.includes("unit") ||
          saveError?.includes("attributes") || saveError?.includes("min_volume")) {
        const { category, unit: u, attributes: a, min_volume, ...rest } = payload;
        payload = rest;
        saveError = await save(payload);
      }

      if (saveError) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(uploadedPaths);
        }
        toast.error(saveError);
        return;
      }

      toast.success(editId ? "Товар обновлен" : "Товар добавлен");
      resetSelectedImage();
      setModalOpen(false);
      loadProducts();
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить изображение. Товар не сохранен.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Удалить этот товар?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Ошибка удаления"); return; }
    toast.success("Товар удален");
    loadProducts();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
      return;
    }
    if (name === "price") {
      setForm((prev) => ({
        ...prev,
        price: isKztPriced(prev.category)
          ? normalizeIntInput(value)
          : normalizeDecimalInput(value),
      }));
      return;
    }
    if (["volume_ml", "count", "min_volume"].includes(name)) {
      setForm((prev) => ({ ...prev, [name]: normalizeIntInput(value) }));
      return;
    }
    if (name === "category") {
      setForm((prev) => ({ ...prev, category: value as ProductCategory, attributes: {}, price: "" }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAttrChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, attributes: { ...prev.attributes, [key]: value } }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) { resetSelectedImage(); return; }
    const validationError = validateImageFile(file);
    if (validationError) { toast.error(validationError); resetSelectedImage(); e.target.value = ""; return; }
    setSelectedImageFile(file);
    setSelectedImagePreviewUrl(URL.createObjectURL(file));
    setPreviewImageError(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const isAccessory = form.category === "accessory";
  const isKztInput = isKztPriced(form.category);
  const priceLabel = isKztInput ? "Цена, ₸" : isMl ? "Цена, $/мл" : "Цена, $";
  const countLabel = isMl ? "Запас, мл" : "Остаток, шт.";
  const countHelp = isMl ? "Общий запас в мл" : "Если товара нет, поставьте 0";
  const attrFields = CATEGORY_ATTR_FIELDS[form.category];

  // Aggregated stats — total / linked to Ainur / total live stock from Ainur
  const ainurLinkedCount = useMemo(
    () => products.filter((p) => p.ainur_id && p.ainur_id in ainurStockById).length,
    [products, ainurStockById],
  );
  const ainurStockTotal = useMemo(
    () => Object.values(ainurStockById).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [ainurStockById],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Товары</h1>
        {isAdmin && (
          <button onClick={openNew} className="btn-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer">
            <Plus size={16} className="relative z-10" />
            <span>Добавить</span>
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--dark-2)] p-3">
          <p className="text-xs text-[var(--text-secondary)]">Всего товаров</p>
          <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{products.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--dark-2)] p-3">
          <p className="text-xs text-[var(--text-secondary)]">Привязано к Ainur</p>
          <p className="text-xl font-bold text-[var(--gold)] mt-1">
            {ainurLinkedCount}
            <span className="text-xs font-medium text-[var(--text-secondary)] ml-2">
              из {products.length}
              {products.length > 0 && ` (${Math.round((100 * ainurLinkedCount) / products.length)}%)`}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--dark-2)] p-3">
          <p className="text-xs text-[var(--text-secondary)]">Остаток в Ainur</p>
          <p className="text-xl font-bold text-green-400 mt-1">
            {ainurStockTotal.toLocaleString("ru-RU")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--dark-2)] p-3">
          <p className="text-xs text-[var(--text-secondary)]">Товаров в Ainur</p>
          <p className="text-xl font-bold text-[var(--text-primary)] mt-1">
            {Object.keys(ainurStockById).length}
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="admin-filter-bar">
        <div className="admin-filter-search-row">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, бренду или коду..."
              className="input-dark w-full pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                aria-label="Очистить"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <span className="admin-filter-count">
            {filteredProducts.length === products.length
              ? `${products.length} товаров`
              : `${filteredProducts.length} из ${products.length}`}
          </span>
        </div>

        <div className="admin-filter-groups">
          <div className="admin-filter-group">
            <span className="admin-filter-label">Категория</span>
            <div className="admin-filter-pills">
              {([
                ["all", "Все"],
                ["oil", "Масла"],
                ["perfume", "Парфюм"],
                ["original", "Оригинал"],
                ["analog", "Аналог"],
                ["accessory", "Аксессуары"],
              ] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilterCategory(val)}
                  className={`admin-filter-pill${filterCategory === val ? " is-active" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filterCategory !== "accessory" && (
            <>
              <div className="admin-filter-divider" />
              <div className="admin-filter-group">
                <span className="admin-filter-label">Тип</span>
                <div className="admin-filter-pills">
                  <button onClick={() => setFilterQuality("all")}
                    className={`admin-filter-pill${filterQuality === "all" ? " is-active" : ""}`}>
                    Все
                  </button>
                  <button onClick={() => setFilterQuality("deluxe")}
                    className={`admin-filter-pill${filterQuality === "deluxe" ? " is-active is-active-deluxe" : ""}`}>
                    De Luxe
                  </button>
                  <button onClick={() => setFilterQuality("premium")}
                    className={`admin-filter-pill${filterQuality === "premium" ? " is-active is-active-premium" : ""}`}>
                    Premium
                  </button>
                </div>
              </div>
            </>
          )}

          {filterCategory === "accessory" && accessoryTypes.length > 0 && (
            <>
              <div className="admin-filter-divider" />
              <div className="admin-filter-group">
                <span className="admin-filter-label">Вид</span>
                <div className="admin-filter-pills">
                  <button onClick={() => setFilterAccessoryType("all")}
                    className={`admin-filter-pill${filterAccessoryType === "all" ? " is-active" : ""}`}>
                    Все
                  </button>
                  {(showAllAccessoryTypes ? accessoryTypes : accessoryTypes.slice(0, ADMIN_FILTER_LIMIT)).map((type) => (
                    <button key={type} onClick={() => setFilterAccessoryType(type)}
                      className={`admin-filter-pill${filterAccessoryType === type ? " is-active" : ""}`}>
                      {type}
                    </button>
                  ))}
                  {accessoryTypes.length > ADMIN_FILTER_LIMIT && (
                    <button onClick={() => setShowAllAccessoryTypes((v) => !v)}
                      className="admin-filter-pill" style={{ borderStyle: "dashed", opacity: 0.7 }}>
                      {showAllAccessoryTypes ? "Скрыть" : `+${accessoryTypes.length - ADMIN_FILTER_LIMIT}`}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="admin-filter-divider" />

          <div className="admin-filter-group">
            <span className="admin-filter-label">Наличие</span>
            <div className="admin-filter-pills">
              {([["all", "Все"], ["in", "В наличии"], ["out", "Нет"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilterStock(val)}
                  className={`admin-filter-pill${filterStock === val ? " is-active" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {availableGenders.length > 0 && filterCategory !== "accessory" && (
            <>
              <div className="admin-filter-divider" />
              <div className="admin-filter-group">
                <span className="admin-filter-label">Пол</span>
                <div className="admin-filter-pills">
                  <button onClick={() => setFilterGender("all")}
                    className={`admin-filter-pill${filterGender === "all" ? " is-active" : ""}`}>
                    Все
                  </button>
                  {availableGenders.map((g) => (
                    <button key={g} onClick={() => setFilterGender(g)}
                      className={`admin-filter-pill${filterGender === g ? " is-active" : ""}`}>
                      {GENDER_LABELS[g] ?? g}
                    </button>
                  ))}
                  {hasProductsWithoutGender && (
                    <button onClick={() => setFilterGender("__empty__")}
                      className={`admin-filter-pill${filterGender === "__empty__" ? " is-active" : ""}`}>
                      Не указан
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {availableCountries.length > 0 && filterCategory !== "accessory" && (
            <>
              <div className="admin-filter-divider" />
              <div className="admin-filter-group">
                <span className="admin-filter-label">Страна</span>
                <div className="admin-filter-pills">
                  <button onClick={() => setFilterCountry("all")}
                    className={`admin-filter-pill${filterCountry === "all" ? " is-active" : ""}`}>
                    Все
                  </button>
                  {(showAllCountries ? availableCountries : availableCountries.slice(0, ADMIN_FILTER_LIMIT)).map((c) => (
                    <button key={c} onClick={() => setFilterCountry(c)}
                      className={`admin-filter-pill${filterCountry === c ? " is-active" : ""}`}>
                      {c}
                    </button>
                  ))}
                  {availableCountries.length > ADMIN_FILTER_LIMIT && (
                    <button onClick={() => setShowAllCountries((v) => !v)}
                      className="admin-filter-pill" style={{ borderStyle: "dashed", opacity: 0.7 }}>
                      {showAllCountries ? "Скрыть" : `+${availableCountries.length - ADMIN_FILTER_LIMIT}`}
                    </button>
                  )}
                  {hasProductsWithoutCountry && (
                    <button onClick={() => setFilterCountry("__empty__")}
                      className={`admin-filter-pill${filterCountry === "__empty__" ? " is-active" : ""}`}>
                      Не указана
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="admin-filter-divider" />

          <div className="admin-filter-group">
            <span className="admin-filter-label">Хиты</span>
            <div className="admin-filter-pills">
              <button onClick={() => setFilterFeatured(false)}
                className={`admin-filter-pill${!filterFeatured ? " is-active" : ""}`}>
                Все
              </button>
              <button onClick={() => setFilterFeatured(true)}
                className={`admin-filter-pill${filterFeatured ? " is-active" : ""}`}>
                Только хиты
              </button>
            </div>
          </div>

          <div className="admin-filter-divider" />

          <div className="admin-filter-group">
            <span className="admin-filter-label">Привязка</span>
            <div className="admin-filter-pills">
              {([
                ["all", "Все"],
                ["linked", "Привязаны"],
                ["unlinked", "Не привязаны"],
                ["stale", "Битая привязка"],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterAinurLink(val)}
                  className={`admin-filter-pill${filterAinurLink === val ? " is-active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : filteredProducts.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-12">{products.length === 0 ? "Нет товаров" : "Ничего не найдено"}</p>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="pb-3 pr-4">Фото</th>
                <th className="pb-3 pr-4 hidden sm:table-cell">Код</th>
                <th className="pb-3 pr-4">Название</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Бренд</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Категория</th>
                <th className="pb-3 pr-4 hidden lg:table-cell">Тип</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Цена</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Наличие</th>
                <th className="pb-3 pr-4 hidden xl:table-cell">Ainur</th>
                {isAdmin && <th className="pb-3 text-right">Действия</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.slice((adminPage - 1) * ADMIN_PAGE_SIZE, adminPage * ADMIN_PAGE_SIZE).map((product) => {
                const supabaseCount = Number(product.count ?? 0);
                const linkedAinurId = product.ainur_id ?? null;
                const ainurCount = linkedAinurId && linkedAinurId in ainurStockById
                  ? ainurStockById[linkedAinurId]
                  : null;
                const isLinked = ainurCount !== null;
                const productCount = isLinked ? ainurCount! : supabaseCount;
                const isAvailable = productCount > 0;
                const stockBadgeClass = isLinked
                  ? isAvailable
                    ? "bg-[var(--gold)]/15 text-[var(--gold)] ring-1 ring-[var(--gold)]/40"
                    : "bg-red-500/10 text-red-400 ring-1 ring-[var(--gold)]/40"
                  : isAvailable
                    ? "bg-green-500/10 text-green-400"
                    : "bg-red-500/10 text-red-400";
                const unit = product.unit ?? "pcs";
                const cat = product.category ?? "perfume";
                return (
                  <tr key={product.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4"><ProductThumbnail product={product} /></td>
                    <td className="py-3 pr-4 hidden sm:table-cell">
                      {product.code ? (
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--gold)]/15 text-[var(--gold)]">
                          {product.code}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-primary)]">{product.name}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)] hidden md:table-cell">{cat !== "accessory" ? product.brand : "—"}</td>
                    <td className="py-3 pr-4 hidden md:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)]">
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 hidden lg:table-cell">
                      {cat !== "accessory" && product.attributes?.quality === "De Luxe" && (
                        <span className="badge badge-deluxe">De Luxe</span>
                      )}
                      {cat !== "accessory" && product.attributes?.quality === "Premium" && (
                        <span className="badge badge-premium">Premium</span>
                      )}
                      {cat === "accessory" && product.attributes?.type && (
                        <span className="text-xs text-[var(--text-secondary)]">{String(product.attributes.type)}</span>
                      )}
                      {!product.attributes?.quality && !product.attributes?.type && (
                        <span className="text-xs text-[var(--text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[var(--gold)] hidden md:table-cell">
                      {isKztPriced(cat)
                        ? formatKzt(product.price_usd)
                        : formatKzt(convertToKzt(product.price_usd, kztRate))}{unit === "ml" ? " /мл" : ""}
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${stockBadgeClass}`}
                        title={
                          isLinked
                            ? `Остаток из Ainur (id: ${linkedAinurId}). В Supabase: ${supabaseCount}`
                            : "Остаток из Supabase (товар не привязан к Ainur)"
                        }
                      >
                        {isLinked && <Link2 size={11} />}
                        {isAvailable ? `${productCount} ${UNIT_LABELS[unit]}` : "Нет в наличии"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 hidden xl:table-cell">
                      {linkedAinurId ? (
                        isLinked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--gold)]" title={linkedAinurId}>
                            <Link2 size={12} />
                            Ainur
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-400" title={linkedAinurId}>
                            <Link2 size={12} />
                            нет в Ainur
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          <Link2Off size={12} />
                          не привязан
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(product)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer"><Pencil size={15} /></button>
                          <button onClick={() => handleDelete(product.id)} className="p-2 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Admin pagination */}
        <Pagination
          page={adminPage}
          total={filteredProducts.length}
          pageSize={ADMIN_PAGE_SIZE}
          variant="dark"
          className="mt-4"
          onChange={setAdminPage}
        />
        </>
      )}

      {modalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card modal-form w-full max-w-xl p-6 bg-[var(--dark-2)] overflow-y-auto max-h-[90vh]">
            <div className="modal-form-header">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{editId ? "Редактировать" : "Новый товар"}</h2>
              <button type="button" onClick={closeModal} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer" aria-label="Закрыть">
                <X size={20} />
              </button>
            </div>

            <div className="modal-form-body">
              {/* Category selector */}
              <div className="form-group">
                <label htmlFor="product-category" className="form-label">Категория</label>
                <select id="product-category" name="category" value={form.category} onChange={handleChange} className="input-dark">
                  <option value="oil">Масло</option>
                  <option value="perfume">Парфюм</option>
                  <option value="original">Оригинал</option>
                  <option value="analog">Аналог</option>
                  <option value="accessory">Аксессуар</option>
                </select>
              </div>

              {/* Name & Brand */}
              <div className="form-group">
                <label htmlFor="product-name" className="form-label">Название товара</label>
                <input id="product-name" name="name" value={form.name} onChange={handleChange} placeholder="Например: Coco Mademoiselle" className="input-dark" />
              </div>

              <div className="form-group">
                <label htmlFor="product-code" className="form-label">Код товара</label>
                <input
                  id="product-code"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  placeholder="Например: 00655"
                  className="input-dark font-mono"
                />
                <p className="form-help">
                  Можно ввести вручную или подтянуть из Ainur при привязке. Используется для поиска в админке.
                </p>
              </div>

              {form.category !== "accessory" && (
                <div className="form-group">
                  <label htmlFor="product-brand" className="form-label">Бренд</label>
                  <input id="product-brand" name="brand" value={form.brand} onChange={handleChange} placeholder="Например: Chanel" className="input-dark" />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="product-description" className="form-label">Описание</label>
                <textarea id="product-description" name="description" value={form.description} onChange={handleChange} placeholder="Краткое описание" rows={3} className="input-dark resize-none" />
              </div>

              {/* Price, Count, Volume fields — labels change based on category */}
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="product-price" className="form-label">{priceLabel}</label>
                  <input
                    id="product-price"
                    name="price"
                    type="text"
                    inputMode={isKztInput ? "numeric" : "decimal"}
                    value={form.price}
                    onChange={handleChange}
                    placeholder={isKztInput ? "Например: 3500" : isMl ? "Например: 2.50" : "Например: 5.00"}
                    className="input-dark"
                  />
                  {!isKztInput && form.price && Number(form.price) > 0 && (
                    <p className="form-help" style={{ color: "var(--gold)" }}>
                      ≈ {formatKzt(convertToKzt(Number(form.price), kztRate))}{isMl ? " / мл" : ""}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="product-count" className="form-label">{countLabel}</label>
                  <input id="product-count" name="count" type="text" inputMode="numeric" pattern="[0-9]*" value={form.count} onChange={handleChange} placeholder="Например: 500" className="input-dark" />
                  <p className="form-help">{countHelp}</p>
                </div>

                {/* Min volume — only for ml products */}
                {isMl && (
                  <div className="form-group">
                    <label htmlFor="product-min-volume" className="form-label">Мин. объём, мл</label>
                    <input id="product-min-volume" name="min_volume" type="text" inputMode="numeric" pattern="[0-9]*" value={form.min_volume} onChange={handleChange} placeholder="50" className="input-dark" />
                    <p className="form-help">Минимальный заказ (по умолчанию 1 мл)</p>
                  </div>
                )}

                {/* Bottle volume — optional, ml products only */}
                {isMl && (
                  <div className="form-group">
                    <label htmlFor="product-volume" className="form-label">Объём флакона, мл (необяз.)</label>
                    <input id="product-volume" name="volume_ml" type="text" inputMode="numeric" pattern="[0-9]*" value={form.volume_ml} onChange={handleChange} placeholder="100" className="input-dark" />
                  </div>
                )}
              </div>

              {/* Category-specific attributes */}
              {attrFields.length > 0 && (
                <div className="form-group">
                  <p className="form-label" style={{ marginBottom: 8 }}>Характеристики</p>
                  <div className="form-grid">
                    {attrFields.map(({ key, label, placeholder }) => (
                      <div key={key} className="form-group">
                        <label htmlFor={`attr-${key}`} className="form-label">{label}</label>
                        {key === "gender" ? (
                          <select
                            id={`attr-${key}`}
                            value={form.attributes[key] ?? "unisex"}
                            onChange={(e) => handleAttrChange(key, e.target.value)}
                            className="input-dark"
                          >
                            {GENDER_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : key === "quality" ? (
                          <select
                            id={`attr-${key}`}
                            value={form.attributes[key] ?? ""}
                            onChange={(e) => handleAttrChange(key, e.target.value)}
                            className="input-dark"
                          >
                            <option value="">— не указано —</option>
                            {qualityOptions.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={`attr-${key}`}
                            type="text"
                            value={form.attributes[key] ?? ""}
                            onChange={(e) => handleAttrChange(key, e.target.value)}
                            placeholder={placeholder}
                            className="input-dark"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Country of origin — oil and perfume only. Code is managed per-country
                  in /admin/settings, not here. */}
              {form.category !== "accessory" && (
                <div className="form-group">
                  <label htmlFor="product-country" className="form-label">Страна происхождения</label>
                  <select
                    id="product-country"
                    value={form.country_of_origin}
                    onChange={(e) => setForm((prev) => ({ ...prev, country_of_origin: e.target.value }))}
                    className="input-dark"
                  >
                    <option value="">— не указана —</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <p className="form-help">Список и коды стран меняются в Настройках.</p>
                </div>
              )}

              {/* Image upload */}
              <div className="form-group">
                <label htmlFor="product-image-file" className="form-label">Изображение товара</label>
                <p className="form-help">JPG, PNG или WebP до 5MB</p>
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--dark-3)]">
                  {imagePreviewSrc && !previewImageError ? (
                    <img src={imagePreviewSrc} alt="" className="h-full w-full object-cover" onError={() => setPreviewImageError(true)} />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-center text-[var(--gold-dark)]">
                      <div>
                        <ImageIcon size={42} strokeWidth={1.2} className="mx-auto" />
                        <span className="mt-2 block text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">AZ-ZAHRA</span>
                      </div>
                    </div>
                  )}
                  {selectedImageFile && (
                    <button type="button" onClick={resetSelectedImage} className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[var(--text-primary)] shadow-sm transition-colors hover:text-red-500" aria-label="Убрать изображение">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <label htmlFor="product-image-file" className="input-dark flex cursor-pointer items-center gap-2 text-sm">
                  <Upload size={16} className="shrink-0 text-[var(--gold-dark)]" />
                  <span className="truncate">{selectedImageFile ? selectedImageFile.name : "Загрузить изображение"}</span>
                  <input id="product-image-file" ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={handleImageFileChange} disabled={saving} className="sr-only" />
                </label>
              </div>

              {/* Ainur linkage */}
              <div className="form-group">
                <label className="form-label">Привязка к Ainur</label>
                <p className="form-help">Остаток у этого товара в каталоге будет браться из связанного товара Ainur.</p>
                {form.ainur_id ? (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 min-w-0 rounded-lg border border-[var(--gold)]/40 bg-[var(--gold)]/5 px-3 py-2">
                      <p className="text-xs text-[var(--text-secondary)]">Привязан к:</p>
                      <p className="text-sm text-[var(--text-primary)] truncate">{form.ainur_name ?? form.ainur_id}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">id: {form.ainur_id}</p>
                      {form.ainur_id in ainurStockById && (
                        <p className="text-xs text-green-400 mt-1">
                          Сейчас в Ainur: {ainurStockById[form.ainur_id].toLocaleString("ru-RU")} шт.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAinurPickerOpen(true)}
                      className="btn-outline-gold text-xs px-3 py-2 rounded-lg cursor-pointer"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={handleAinurClear}
                      className="text-[var(--text-secondary)] hover:text-red-400 transition-colors p-2 cursor-pointer"
                      aria-label="Отвязать"
                    >
                      <Link2Off size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAinurPickerOpen(true)}
                    className="btn-outline-gold w-full mt-2 py-2 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Link2 size={14} />
                    Привязать к товару Ainur
                  </button>
                )}
              </div>

              {/* Featured toggle */}
              <div className="form-group form-group-inline">
                <input id="product-featured" type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleChange} className="accent-[var(--gold)] w-4 h-4" />
                <label htmlFor="product-featured" className="form-label cursor-pointer">Хит продаж</label>
              </div>
            </div>

            <div className="modal-form-actions">
              <button type="button" onClick={closeModal} className="btn-outline-gold flex-1 py-2.5 rounded-lg text-sm cursor-pointer">Отмена</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-gold flex-1 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin relative z-10" /> : <Save size={16} className="relative z-10" />}
                <span>{saving ? "Сохранение..." : "Сохранить"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {ainurPickerOpen && (
        <AinurPicker
          value={form.ainur_id}
          takenIds={takenAinurIds}
          initialSearch={form.name}
          onPick={handleAinurPick}
          onClose={() => setAinurPickerOpen(false)}
        />
      )}
    </div>
  );
}
