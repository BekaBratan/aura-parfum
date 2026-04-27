"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminRole } from "@/lib/adminRole";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import { Product } from "@/types";

interface FormState {
  name: string;
  brand: string;
  description: string;
  price: number;
  gender: "men" | "women" | "unisex";
  volume_ml: number;
  image_url: string;
  in_stock: boolean;
  is_featured: boolean;
}

const emptyProduct: FormState = {
  name: "",
  brand: "",
  description: "",
  price: 0,
  gender: "unisex",
  volume_ml: 100,
  image_url: "",
  in_stock: true,
  is_featured: false,
};

export default function AdminProducts() {
  const { role } = useAdminRole();
  const isAdmin = role === "admin";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyProduct);

  const supabase = createClient();

  async function loadProducts() {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts((data as Product[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const openNew = () => {
    if (!isAdmin) return;
    setEditId(null);
    setForm(emptyProduct);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    if (!isAdmin) return;
    setEditId(product.id);
    setForm({
      name: product.name,
      brand: product.brand,
      description: product.description || "",
      price: product.price,
      gender: product.gender,
      volume_ml: product.volume_ml || 100,
      image_url: product.image_url || "",
      in_stock: product.in_stock,
      is_featured: product.is_featured,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    if (!form.name || !form.brand || !form.price) {
      toast.error("Заполните название, бренд и цену");
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name,
      brand: form.brand,
      description: form.description || null,
      price: Number(form.price),
      gender: form.gender,
      volume_ml: form.volume_ml ? Number(form.volume_ml) : null,
      image_url: form.image_url || null,
      in_stock: form.in_stock,
      is_featured: form.is_featured,
    };

    if (editId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editId);
      if (error) {
        toast.error("Ошибка обновления");
        setSaving(false);
        return;
      }
      toast.success("Товар обновлен");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) {
        toast.error("Ошибка создания");
        setSaving(false);
        return;
      }
      toast.success("Товар добавлен");
    }

    setSaving(false);
    setModalOpen(false);
    loadProducts();
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Удалить этот товар?")) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Ошибка удаления");
      return;
    }

    toast.success("Товар удален");
    loadProducts();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((current) => ({ ...current, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((current) => ({ ...current, [name]: value }));
    }
  };

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
                <th className="pb-3 pr-4 hidden md:table-cell">Цена</th>
                <th className="pb-3 pr-4 hidden md:table-cell">Наличие</th>
                {isAdmin && <th className="pb-3 text-right">Действия</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--dark-3)] relative">
                      {product.image_url ? <Image src={product.image_url} alt="" fill className="object-cover" sizes="40px" /> : null}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-[var(--text-primary)]">{product.name}</td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)] hidden sm:table-cell">{product.brand}</td>
                  <td className="py-3 pr-4 text-[var(--gold)] hidden md:table-cell">{formatPrice(product.price)}</td>
                  <td className="py-3 pr-4 hidden md:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${product.in_stock ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                      {product.in_stock ? "Есть" : "Нет"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(product)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 bg-[var(--dark-2)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{editId ? "Редактировать" : "Новый товар"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input name="name" value={form.name} onChange={handleChange} placeholder="Название" className="input-dark" />
              <input name="brand" value={form.brand} onChange={handleChange} placeholder="Бренд" className="input-dark" />
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Описание" rows={3} className="input-dark resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input name="price" type="number" value={form.price} onChange={handleChange} placeholder="Цена (₸)" className="input-dark" />
                <input name="volume_ml" type="number" value={form.volume_ml} onChange={handleChange} placeholder="Объем (мл)" className="input-dark" />
              </div>
              <select name="gender" value={form.gender} onChange={handleChange} className="input-dark">
                <option value="men">Мужской</option>
                <option value="women">Женский</option>
                <option value="unisex">Унисекс</option>
              </select>
              <input name="image_url" value={form.image_url} onChange={handleChange} placeholder="URL изображения" className="input-dark" />
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" name="in_stock" checked={form.in_stock} onChange={handleChange} className="accent-[var(--gold)] w-4 h-4" /> В наличии
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleChange} className="accent-[var(--gold)] w-4 h-4" /> Хит продаж
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="btn-outline-gold flex-1 py-2.5 rounded-lg text-sm cursor-pointer">Отмена</button>
              <button onClick={handleSave} disabled={saving} className="btn-gold flex-1 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
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
