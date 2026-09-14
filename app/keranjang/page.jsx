"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, rupiah } from "../../lib/supabase";
import { useCart } from "../../lib/cart";

export default function Keranjang() {
  const { list, setQty, totalPrice, clear } = useCart();
  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState(undefined); // undefined = belum dicek
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("batches")
        .select("name, note")
        .eq("status", "buka")
        .maybeSingle();
      setBatch(data || null);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (list.length === 0) return;
    setSaving(true);
    setError("");

    try {
      // Total dihitung ulang di server dari harga database,
      // jadi angka di layar ini murni buat ditampilkan.
      const res = await fetch("/api/pesanan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: nama.trim(),
          phone: wa.trim(),
          notes: catatan.trim(),
          items: list.map((i) => ({ product_id: i.product.id, qty: i.qty })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Gagal membuat pesanan.");
        setSaving(false);
        return;
      }

      clear();
      router.push(`/bayar/${data.id}`);
    } catch {
      setError("Gagal menghubungi server. Cek koneksi internetmu.");
      setSaving(false);
    }
  };

  return (
    <main className="pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-brand-500 px-4 py-4 text-white shadow">
        <Link href="/" className="text-2xl leading-none">
          ←
        </Link>
        <h1 className="text-lg font-extrabold">Keranjang</h1>
      </header>

      {batch === null && (
        <div className="mx-4 mt-4 rounded-2xl bg-stone-200 px-4 py-3 text-center text-sm font-semibold text-stone-600">
          😴 PO lagi tutup, pesanan belum bisa dikirim.
        </div>
      )}

      {list.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-stone-500">Keranjang masih kosong.</p>
          <Link href="/" className="mt-3 inline-block font-semibold text-brand-600 underline">
            Pilih kripik dulu →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3 p-4">
            {list.map(({ product, qty }) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold leading-tight">{product.name}</p>
                  <p className="text-sm font-bold text-brand-600">{rupiah(product.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty(product, qty - 1)}
                    className="h-8 w-8 rounded-full bg-brand-100 text-lg font-bold text-brand-600"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{qty}</span>
                  <button
                    onClick={() => setQty(product, qty + 1)}
                    className="h-8 w-8 rounded-full bg-brand-500 text-lg font-bold text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-4 flex items-center justify-between rounded-2xl bg-brand-100 px-4 py-3">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-extrabold text-brand-700">{rupiah(totalPrice)}</span>
          </div>

          {batch && (
            <p className="px-4 pt-3 text-center text-xs text-stone-500">
              Pesanan masuk ke <b className="text-stone-700">{batch.name}</b>
            </p>
          )}

          <form onSubmit={submit} className="space-y-3 p-4">
            <input
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama kamu"
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-brand-500"
            />
            <input
              required
              value={wa}
              onChange={(e) => setWa(e.target.value)}
              placeholder="No. WhatsApp (contoh: 08123456789)"
              inputMode="tel"
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-brand-500"
            />
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan (opsional)"
              rows={2}
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-brand-500"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              disabled={saving || batch === null}
              className="w-full rounded-2xl bg-brand-600 py-4 font-bold text-white shadow-lg disabled:opacity-50"
            >
              {saving ? "Menyimpan…" : `Buat Pesanan • ${rupiah(totalPrice)}`}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
