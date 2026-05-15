"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminRole } from "@/lib/adminRole";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, CATEGORY_LABELS, UNIT_LABELS } from "@/lib/utils";
import { Product, ProductCategory } from "@/types";
import { COUNTRIES } from "@/lib/countries";

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
  count: string;
  is_featured: boolean;
  attributes: Record<string, string>;
  country_of_origin: string;
}

const emptyProduct: FormState = {
  name: "",
  brand: "",
  description: "",
  price: "",
  category: "perfume",
  volume_ml: "",
  min_volume: "",
  image_url: "",
  count: "",
  is_featured: false,
  attributes: {},
  country_of_origin: "",
};

// ─── Category-specific attribute field configs ─────────────────────────────

type AttrField = { key: string; label: string; placeholder: string };

const CATEGORY_ATTR_FIELDS: Record<ProductCategory, AttrField[]> = {
  oil: [
    { key: "oil_type",    label: "Тип масла",               placeholder: "базовое, эфирное, смесь..." },
    { key: "aroma_note",  label: "Нота / аромат",            placeholder: "роза, жасмин, мята..." },
  ],
  perfume: [
    { key: "gender",      label: "Пол",                      placeholder: "" },
    { key: "family",      label: "Семейство аромата",        placeholder: "цветочный, восточный, древесный..." },
  ],
  accessory: [
    { key: "type",        label: "Тип аксессуара",           placeholder: "флакон, воронка, браслет..." },
    { key: "material",    label: "Материал",                 placeholder: "стекло, металл, силикон..." },
    { key: "color",       label: "Цвет",                     placeholder: "прозрачный, золотой, чёрный..." },
  ],
};

const GENDER_OPTIONS = [
  { value: "unisex", label: "Унисекс" },
  { value: "men",    label: "Мужской" },
  { value: "women",  label: "Женский" },
];

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

function normalizeNumericInput(value: string, allowZero: boolean): string {
  const digits = value.replace(/\D/g, "");
  if (digits === "") return "";
  const normalized = digits.replace(/^0+(?=\d)/, "");
  if (!allowZero && normalized === "0") return "";
  return normalized;
}

// ─── Thumbnail component ───────────────────────────────────────────────────

function ProductThumbnail({ product }: { product: Product }) {
  const [imageError, setImageError] = useState(false);
  useEffect(() => setImageError(false), [product.image_url]);
  return (
    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--dark-3)] relative">
      {product.image_url && !imageError ? (
        <Image src={product.image_url} alt="" fill className="object-cover" sizes="40px" onError={() => setImageError(true)} />
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

  const supabase = createClient();
  const imagePreviewSrc = selectedImagePreviewUrl || form.image_url.trim();
  const isMl = form.category !== "accessory";

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

  useEffect(() => { loadProducts(); }, []);

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
    setForm({
      name: product.name,
      brand: product.brand,
      description: product.description || "",
      price: String(product.price ?? ""),
      category: product.category ?? "perfume",
      volume_ml: product.volume_ml === null ? "" : String(product.volume_ml),
      min_volume: product.min_volume === null ? "" : String(product.min_volume),
      image_url: product.image_url || "",
      count: String(product.count ?? 0),
      is_featured: product.is_featured,
      country_of_origin: product.country_of_origin ?? "",
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

  const uploadSelectedImage = async () => {
    if (!selectedImageFile) return null;
    const imagePath = createUploadPath(selectedImageFile, form, editId);
    const { error } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(imagePath, selectedImageFile, { cacheControl: "3600", contentType: selectedImageFile.type || undefined, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(imagePath);
    return { path: imagePath, publicUrl: data.publicUrl };
  };

  const handleSave = async () => {
    if (!isAdmin) return;

    if (!form.name || !form.brand) { toast.error("Заполните название и бренд"); return; }
    if (form.price === "") { toast.error("Укажите цену товара"); return; }
    const price = Number(form.price);
    if (price <= 0) { toast.error("Цена должна быть больше 0"); return; }
    if (form.count === "") { toast.error("Укажите количество товара"); return; }
    const count = Math.floor(Number(form.count));
    if (count < 0) { toast.error("Количество не может быть отрицательным"); return; }

    const volumeMl = form.volume_ml === "" ? null : Number(form.volume_ml);
    if (volumeMl !== null && volumeMl <= 0) { toast.error("Объем должен быть больше 0"); return; }

    const minVolume = form.min_volume === "" ? null : Number(form.min_volume);
    if (minVolume !== null && minVolume <= 0) { toast.error("Минимальный объём должен быть больше 0"); return; }

    setSaving(true);
    let uploadedPath: string | null = null;

    try {
      const uploadedImage = await uploadSelectedImage();
      uploadedPath = uploadedImage?.path || null;
      const imageUrl = uploadedImage?.publicUrl || form.image_url || null;

      const unit = form.category === "accessory" ? "pcs" : "ml";

      // Build attributes object
      const attrs: Record<string, string> = {};
      for (const { key } of CATEGORY_ATTR_FIELDS[form.category]) {
        const val = form.attributes[key]?.trim();
        if (val) attrs[key] = val;
      }

      // Derive gender for DB column (for perfumes from attributes, else unisex)
      const genderVal = form.category === "perfume"
        ? ((form.attributes["gender"] ?? "unisex") as "men" | "women" | "unisex")
        : "unisex";

      const payload = {
        name: form.name,
        brand: form.brand,
        description: form.description || null,
        price,
        gender: genderVal,
        volume_ml: volumeMl,
        image_url: imageUrl,
        count,
        is_featured: form.is_featured,
        category: form.category,
        unit,
        min_volume: minVolume,
        attributes: attrs,
        country_of_origin: (form.category !== "accessory" && form.country_of_origin)
          ? form.country_of_origin
          : null,
      };

      let saveError: string | null = null;
      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        saveError = error?.message || null;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        saveError = error?.message || null;
      }

      if (saveError) {
        if (uploadedPath) await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([uploadedPath]);
        toast.error(editId ? "Ошибка обновления" : "Ошибка создания");
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
    if (["price", "volume_ml", "count", "min_volume"].includes(name)) {
      setForm((prev) => ({ ...prev, [name]: normalizeNumericInput(value, name === "count") }));
      return;
    }
    if (name === "category") {
      // Reset category-specific attributes when switching category
      setForm((prev) => ({ ...prev, category: value as ProductCategory, attributes: {} }));
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

  const priceLabel = isMl ? "Цена, ₸/мл" : "Цена, ₸/шт.";
  const countLabel = isMl ? "Запас, мл" : "Остаток, шт.";
  const countHelp = isMl ? "Общий запас в мл" : "Если товара нет, поставьте 0";
  const attrFields = CATEGORY_ATTR_FIELDS[form.category];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Товары</h1>
        {isAdmin && (
          <button onClick={openNew} className="btn-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer">
            <Plus size={16} className="relative z-10" />
            <span>Добавить</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : products.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-12">Нет товаров</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="pb-3 pr-4">Фото</th>
                <th className="pb-3 pr-4">Название</th>
                <th className="pb-3 pr-4 hidden sm:table-cell">Бренд</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Категория</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Цена</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Наличие</th>
                {isAdmin && <th className="pb-3 text-right">Действия</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const productCount = Number(product.count ?? 0);
                const isAvailable = productCount > 0;
                const unit = product.unit ?? "pcs";
                const cat = product.category ?? "perfume";
                return (
                  <tr key={product.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4"><ProductThumbnail product={product} /></td>
                    <td className="py-3 pr-4 text-[var(--text-primary)]">{product.name}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)] hidden sm:table-cell">{product.brand}</td>
                    <td className="py-3 pr-4 hidden md:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)]">
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[var(--gold)] hidden md:table-cell">
                      {formatPrice(product.price)}{unit === "ml" ? " /мл" : ""}
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isAvailable ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                        {isAvailable ? `${productCount} ${UNIT_LABELS[unit]}` : "Нет в наличии"}
                      </span>
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
                  <option value="accessory">Аксессуар</option>
                </select>
              </div>

              {/* Name & Brand */}
              <div className="form-group">
                <label htmlFor="product-name" className="form-label">Название товара</label>
                <input id="product-name" name="name" value={form.name} onChange={handleChange} placeholder="Например: Coco Mademoiselle" className="input-dark" />
              </div>

              <div className="form-group">
                <label htmlFor="product-brand" className="form-label">Бренд</label>
                <input id="product-brand" name="brand" value={form.brand} onChange={handleChange} placeholder="Например: Chanel" className="input-dark" />
              </div>

              <div className="form-group">
                <label htmlFor="product-description" className="form-label">Описание</label>
                <textarea id="product-description" name="description" value={form.description} onChange={handleChange} placeholder="Краткое описание" rows={3} className="input-dark resize-none" />
              </div>

              {/* Price, Count, Volume fields — labels change based on category */}
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="product-price" className="form-label">{priceLabel}</label>
                  <input id="product-price" name="price" type="text" inputMode="numeric" pattern="[0-9]*" value={form.price} onChange={handleChange} placeholder={isMl ? "Например: 910" : "Например: 500"} className="input-dark" />
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
                    <input id="product-min-volume" name="min_volume" type="text" inputMode="numeric" pattern="[0-9]*" value={form.min_volume} onChange={handleChange} placeholder="1" className="input-dark" />
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

              {/* Country of origin — oil and perfume only */}
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
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
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
                        <span className="mt-2 block text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Aura Parfum</span>
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
    </div>
  );
}
