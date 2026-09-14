"use client";

import { useEffect, useState } from "react";
import { supabase, rupiah } from "../../lib/supabase";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(null); // id produk yang barusan tersimpan

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("*").order("name");
      setProducts(data || []);
      setLoading(false);
    })();
  }, []);

  const update = async (id, patch) => {
    const { error } = await supabase.from("products").update(patch).eq("id", id);
    if (error) return alert("Gagal menyimpan: " + error.message);
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaved(id);
    setTimeout(() => setSaved((s) => (s === id ? null : s)), 1500);
  };

  if (loading) return <p className="p-6 text-center text-sm text-stone-500">Memuat…</p>;

  return (
    <div className="space-y-2 p-4">
      {products.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-xl object-cover" />
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">{p.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="500"
                defaultValue={p.price}
                onBlur={(e) => {
                  const v = Math.max(0, Math.floor(Number(e.target.value)) || 0);
                  e.target.value = v;
                  if (v !== p.price) update(p.id, { price: v });
                }}
                className="w-28 rounded-lg border border-stone-200 px-2 py-1 text-sm"
              />
              <span className="text-xs text-stone-400">
                {saved === p.id ? "✅ tersimpan" : rupiah(p.price)}
              </span>
            </div>
          </div>
          <button
            onClick={() => update(p.id, { active: !p.active })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              p.active ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"
            }`}
          >
            {p.active ? "Aktif" : "Nonaktif"}
          </button>
        </div>
      ))}
      <p className="pt-2 text-center text-xs text-stone-400">
        Ubah harga: ketik lalu klik di luar kolom. Tambah produk baru lewat dashboard Supabase.
      </p>
    </div>
  );
}
