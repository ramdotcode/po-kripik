"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, rupiah } from "../lib/supabase";
import { useCart } from "../lib/cart";
import { KONTAK_WA, waLink } from "../lib/toko";

function ProductCard({ product, tutup }) {
  const { items, setQty } = useCart();
  const qty = items[product.id]?.qty || 0;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image_url}
          alt={product.name}
          className={`aspect-square w-full object-cover ${tutup ? "grayscale" : ""}`}
        />
        {product.badge && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">
            ★ {product.badge}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold leading-tight">{product.name}</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="font-bold text-brand-600">{rupiah(product.price)}</span>
          {product.weight && <span className="text-xs text-stone-400">/ {product.weight}</span>}
        </p>

        {tutup ? (
          <p className="mt-2 py-2 text-center text-xs font-semibold text-stone-400">
            PO lagi tutup
          </p>
        ) : qty === 0 ? (
          <button
            onClick={() => setQty(product, 1)}
            className="mt-2 w-full rounded-full bg-brand-500 py-2 text-sm font-bold text-white"
          >
            + Tambah
          </button>
        ) : (
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setQty(product, qty - 1)}
              className="h-9 w-9 rounded-full bg-brand-100 text-lg font-bold text-brand-600"
            >
              −
            </button>
            <span className="font-bold">{qty}</span>
            <button
              onClick={() => setQty(product, qty + 1)}
              className="h-9 w-9 rounded-full bg-brand-500 text-lg font-bold text-white"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Katalog() {
  const [products, setProducts] = useState([]);
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const { totalQty, totalPrice, clear } = useCart();

  useEffect(() => {
    (async () => {
      const [{ data: prod }, { data: btc }] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).order("name"),
        supabase.from("batches").select("*").eq("status", "buka").maybeSingle(),
      ]);
      // Urutan ikut poster (sort_order); yang belum punya urutan di belakang, urut abjad.
      // Kolom sort_order baru ada setelah migration-menu-poster.sql — sebelum itu jatuh ke abjad.
      const urut = (p) => p.sort_order ?? Number.MAX_SAFE_INTEGER;
      setProducts((prod || []).slice().sort((a, b) => urut(a) - urut(b) || a.name.localeCompare(b.name)));
      setBatch(btc || null);
      setLoading(false);
    })();
  }, []);

  const tutup = !loading && !batch;

  // Kalau PO keburu ditutup pas barang masih nyangkut di keranjang,
  // kosongkan biar nggak bingung pas checkout ditolak server.
  useEffect(() => {
    if (tutup && totalQty > 0) clear();
  }, [tutup]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="pb-28">
      <header className="sticky top-0 z-10 bg-brand-500 px-4 py-4 text-white shadow">
        <h1 className="text-xl font-extrabold">🧺 PO Kripik</h1>
        <p className="text-sm text-orange-100">Pesan sekarang, bayar QRIS, tinggal tunggu 😋</p>
      </header>

      {!loading &&
        (batch ? (
          <div className="mx-4 mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              PO lagi buka
            </p>
            <p className="font-extrabold">{batch.name}</p>
            {batch.note && <p className="mt-0.5 text-sm text-stone-500">{batch.note}</p>}
          </div>
        ) : (
          <div className="mx-4 mt-4 rounded-2xl bg-stone-200 px-4 py-4 text-center">
            <p className="text-2xl">😴</p>
            <p className="mt-1 font-extrabold text-stone-700">PO lagi tutup</p>
            <p className="mt-0.5 text-sm text-stone-500">
              Belum ada batch yang dibuka. Pantau terus ya, sebentar lagi buka!
            </p>
          </div>
        ))}

      {loading ? (
        <p className="p-8 text-center text-sm text-stone-500">Memuat produk…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} tutup={tutup} />
          ))}
        </div>
      )}

      {!loading && (
        <p className="px-4 pb-4 text-center text-xs text-stone-400">
          Tanya-tanya soal PO? WhatsApp{" "}
          <a
            href={waLink("Halo, mau tanya soal PO kripik")}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-600 underline"
          >
            {KONTAK_WA}
          </a>
        </p>
      )}

      {totalQty > 0 && !tutup && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md p-4">
          <Link
            href="/keranjang"
            className="flex items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 font-bold text-white shadow-lg"
          >
            <span>🛒 {totalQty} item</span>
            <span>{rupiah(totalPrice)} →</span>
          </Link>
        </div>
      )}
    </main>
  );
}
