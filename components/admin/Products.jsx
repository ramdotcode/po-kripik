"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { IkonCentang } from "../Ikon";

// Urutan sama dengan katalog: urutan poster dulu, sisanya abjad
const posisi = (p) => p.sort_order ?? Number.MAX_SAFE_INTEGER;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(null); // id produk yang barusan tersimpan

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("*").order("name");
      setProducts((data || []).slice().sort((a, b) => posisi(a) - posisi(b) || a.name.localeCompare(b.name, "id")));
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

  if (loading)
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-3xl bg-brand-100/80" />
        ))}
      </div>
    );

  const nAktif = products.filter((p) => p.active).length;

  return (
    <div className="p-4">
      <p className="mb-3 text-sm text-stone-500">
        <b className="text-coklat-900">{nAktif} aktif</b> · {products.length - nAktif} nonaktif
      </p>

      <ul className="space-y-2">
        {products.map((p) => (
          <li key={p.id} className="kartu flex items-center gap-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image_url}
              alt={p.name}
              className={`h-14 w-14 shrink-0 rounded-2xl object-cover ${p.active ? "" : "opacity-60 grayscale"}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold leading-snug ${p.active ? "" : "text-stone-400"}`}>{p.name}</p>
              {(p.weight || p.badge) && (
                <p className="mt-0.5 flex flex-wrap gap-1 text-[10px] font-bold uppercase tracking-wide">
                  {p.weight && <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-coklat-700">{p.weight}</span>}
                  {p.badge && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-red-600">★ {p.badge}</span>}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <label className="relative">
                  <span className="sr-only">Harga {p.name}</span>
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="500"
                    defaultValue={p.price}
                    onBlur={(e) => {
                      const v = Math.max(0, Math.floor(Number(e.target.value)) || 0);
                      e.target.value = v;
                      if (v !== p.price) update(p.id, { price: v });
                    }}
                    className="h-9 w-28 rounded-xl border border-brand-100 bg-white pl-9 pr-2 text-sm font-semibold tabular-nums focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                </label>
                {saved === p.id && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700" role="status">
                    <IkonCentang className="h-3.5 w-3.5" strokeWidth={2.6} />
                    Tersimpan
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={p.active}
              aria-label={`Tampilkan ${p.name} di katalog`}
              onClick={() => update(p.id, { active: !p.active })}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <span className={`relative h-7 w-12 rounded-full transition ${p.active ? "bg-green-500" : "bg-stone-300"}`}>
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    p.active ? "left-[1.375rem]" : "left-0.5"
                  }`}
                />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                {p.active ? "Aktif" : "Nonaktif"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="pt-4 text-center text-xs leading-relaxed text-stone-500">
        Harga tersimpan begitu kamu keluar dari kolom. Produk nonaktif nggak tampil di katalog.
        <br />
        Tambah produk baru lewat dashboard Supabase.
      </p>
    </div>
  );
}
