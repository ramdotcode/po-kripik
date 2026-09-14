"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, rupiah } from "../lib/supabase";
import { useCart } from "../lib/cart";
import { LOKASI_ANTAR, waLink } from "../lib/toko";
import { CaraPesan, Daun, FooterWa, Logo, Percik, Stempel, Stepper } from "../components/Brand";
import {
  IkonBulan,
  IkonChevronBawah,
  IkonHati,
  IkonKalender,
  IkonKeranjang,
  IkonPanahKanan,
  IkonPin,
  IkonToa,
  IkonWhatsApp,
  IkonAkun,
  IkonChevronKanan,
} from "../components/Ikon";

// Urutan poster (sort_order) dulu; yang belum punya urutan di belakang, urut abjad.
// Kolom sort_order baru ada setelah migration-menu-poster.sql — sebelum itu jatuh ke abjad.
const posisi = (p) => p.sort_order ?? Number.MAX_SAFE_INTEGER;
const abjad = (a, b) => a.name.localeCompare(b.name, "id");
const URUTAN = {
  rekomendasi: ["Rekomendasi", (a, b) => posisi(a) - posisi(b) || abjad(a, b)],
  murah: ["Harga termurah", (a, b) => a.price - b.price || abjad(a, b)],
  mahal: ["Harga termahal", (a, b) => b.price - a.price || abjad(a, b)],
  nama: ["Nama A–Z", abjad],
};

function ProductCard({ product, tutup }) {
  const { items, setQty } = useCart();
  const qty = items[product.id]?.qty || 0;

  return (
    <article className="kartu flex flex-col p-1.5">
      <div className="relative overflow-hidden rounded-[1.1rem] bg-brand-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className={`aspect-[3/2] w-full object-cover ${tutup ? "grayscale" : ""}`}
        />
        {product.badge && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md">
            ★ {product.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-2.5">
        <h3 className="text-[13px] font-semibold leading-snug">{product.name}</h3>
        <p className="mt-auto flex flex-wrap items-baseline gap-x-1.5 pt-1.5">
          <span className="text-[17px] font-extrabold tracking-tight text-brand-600">
            {rupiah(product.price)}
          </span>
          {product.weight && <span className="text-xs text-stone-500">/ {product.weight}</span>}
        </p>

        <div className="mt-2.5">
          {tutup ? (
            <p className="flex h-11 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-400">
              PO lagi tutup
            </p>
          ) : qty === 0 ? (
            <button type="button" onClick={() => setQty(product, 1)} className="btn-oranye h-11 w-full text-sm">
              <IkonKeranjang className="h-4 w-4" strokeWidth={2.4} />+ Tambah
            </button>
          ) : (
            <Stepper
              qty={qty}
              nama={product.name}
              onKurang={() => setQty(product, qty - 1)}
              onTambah={() => setQty(product, qty + 1)}
            />
          )}
        </div>
      </div>
    </article>
  );
}

function HeroBatch({ batch, loading }) {
  if (loading) return <div className="mx-4 mt-4 h-44 animate-pulse rounded-3xl bg-brand-100/80" />;

  if (!batch)
    return (
      <div className="mx-4 mt-4 rounded-3xl border border-stone-200 bg-stone-100 px-5 py-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-600 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">
          <IkonBulan className="h-3.5 w-3.5" strokeWidth={2.5} />
          PO lagi tutup
        </span>
        <p className="mt-2 text-2xl font-extrabold leading-tight">Belum ada batch yang buka</p>
        <p className="mt-1 text-sm text-stone-600">Pantau terus ya, sebentar lagi buka!</p>
        <a
          href={waLink("Halo, kabari aku kalau PO kripik buka ya")}
          target="_blank"
          rel="noreferrer"
          className="btn-oranye mt-4 h-11 px-5 text-sm"
        >
          <IkonWhatsApp className="h-4 w-4" />
          Kabari aku via WA
        </a>
      </div>
    );

  return (
    <div className="relative mx-4 mt-4 min-h-[11.5rem] overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-[#fff4e2] via-[#ffe6c4] to-[#ffcf94] px-5 py-5 shadow-[0_8px_24px_-14px_rgba(154,52,18,0.45)]">
      <div className="relative z-10 max-w-[60%]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          <IkonToa className="h-3.5 w-3.5" strokeWidth={2.5} />
          PO sedang dibuka
        </span>
        <p className="mt-2 text-[1.6rem] font-extrabold leading-[1.1] tracking-tight">{batch.name}</p>
        {batch.note && (
          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-coklat-700">
            <IkonKalender className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            {batch.note}
          </p>
        )}
        <a href="#menu" className="btn-oranye mt-4 h-11 px-5 text-sm">
          Pesan Sekarang <IkonPanahKanan className="h-4 w-4" strokeWidth={2.5} />
        </a>
      </div>

      <Percik className="absolute bottom-5 right-[38%] h-7 w-7 -rotate-12 text-brand-500" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/produk/rengginang.jpg"
        alt=""
        className="absolute -bottom-8 -right-8 h-44 w-44 rounded-full border-4 border-white object-cover shadow-lg"
      />
      <Stempel className="absolute right-2 top-2 z-10 h-[5.25rem] w-[5.25rem] rotate-12">
        Stok
        <br />
        terbatas!
      </Stempel>
    </div>
  );
}

export default function Katalog() {
  const [products, setProducts] = useState([]);
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [urut, setUrut] = useState("rekomendasi");
  const { list, totalQty, totalPrice, clear } = useCart();

  useEffect(() => {
    (async () => {
      const [{ data: prod }, { data: btc }] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).order("name"),
        supabase.from("batches").select("*").eq("status", "buka").maybeSingle(),
      ]);
      setProducts(prod || []);
      setBatch(btc || null);
      setLoading(false);
    })();
  }, []);

  const tampil = useMemo(() => products.slice().sort(URUTAN[urut][1]), [products, urut]);
  const tutup = !loading && !batch;
  const adaKeranjang = totalQty > 0 && !tutup;

  // Kalau PO keburu ditutup pas barang masih nyangkut di keranjang,
  // kosongkan biar nggak bingung pas checkout ditolak server.
  useEffect(() => {
    if (tutup && totalQty > 0) clear();
  }, [tutup]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className={`relative ${adaKeranjang ? "pb-32" : "pb-6"}`}>
      <header className="relative flex items-center justify-between gap-3 px-4 pt-6">
        <Percik className="absolute left-1.5 top-4 h-6 w-6 -rotate-45 text-brand-400" />
        <div className="flex min-w-0 items-center gap-2.5 pl-3">
          <Logo className="h-14 w-14 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-[2.1rem] leading-none tracking-wide">PO KRIPIK</h1>
            <p className="mt-1 text-xs leading-snug text-coklat-700">
              Camilan rumahan, siap nemenin ngemil{" "}
              <IkonHati className="inline-block h-3.5 w-3.5 align-[-2px] text-brand-500" />
            </p>
          </div>
        </div>
        <a
          href={waLink("Halo, mau tanya soal PO kripik")}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 flex-col items-center gap-1 text-xs font-semibold"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_6px_14px_-6px_rgba(22,163,74,0.8)]">
            <IkonWhatsApp className="h-6 w-6" />
          </span>
          Chat Kami
        </a>
      </header>

      <Link
        href="/pesanan"
        className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white/90 px-4 py-2.5 text-sm shadow-sm"
      >
        <IkonAkun className="h-5 w-5 shrink-0 text-brand-600" />
        <span className="flex-1 font-semibold">Pesanan Saya</span>
        <span className="text-xs text-stone-500">cek status & bayar</span>
        <IkonChevronKanan className="h-4 w-4 shrink-0 text-brand-400" />
      </Link>

      <HeroBatch batch={batch} loading={loading} />

      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white/90 px-4 py-3 shadow-sm">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-600">
          <IkonPin className="h-5 w-5" />
        </span>
        <p className="text-sm leading-snug">
          <span className="block text-xs text-stone-500">Area pengantaran</span>
          <b>Khusus diantar ke {LOKASI_ANTAR}</b>
        </p>
      </div>

      <CaraPesan className="mx-4 mt-4" />

      <section id="menu" className="scroll-mt-4 px-4 pt-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="whitespace-nowrap text-xl font-extrabold tracking-tight min-[380px]:text-2xl">
            Semua Camilan
          </h2>
          <label className="relative shrink-0">
            <span className="sr-only">Urutkan</span>
            <select
              value={urut}
              onChange={(e) => setUrut(e.target.value)}
              className="h-10 appearance-none rounded-full border border-brand-100 bg-white pl-4 pr-9 text-sm font-semibold shadow-sm focus:outline-none focus:ring-4 focus:ring-brand-100"
            >
              {Object.entries(URUTAN).map(([k, [label]]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <IkonChevronBawah className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="kartu animate-pulse p-1.5">
                  <div className="aspect-[3/2] rounded-[1.1rem] bg-brand-100" />
                  <div className="space-y-2 p-2">
                    <div className="h-3 w-4/5 rounded-full bg-brand-100" />
                    <div className="h-4 w-1/2 rounded-full bg-brand-100" />
                    <div className="h-11 rounded-full bg-brand-100" />
                  </div>
                </div>
              ))
            : tampil.map((p) => <ProductCard key={p.id} product={p} tutup={tutup} />)}
        </div>
      </section>

      {!loading && (
        <>
          <FooterWa
            className="relative z-10 pt-8"
            teks="Tanya-tanya soal PO? WhatsApp"
            pesan="Halo, mau tanya soal PO kripik"
          />
          <p className="relative z-10 pt-2 text-center text-xs text-stone-500">
            <Link href="/privasi" className="underline underline-offset-2">
              Kebijakan Privasi
            </Link>
          </p>
        </>
      )}
      <Daun className="pointer-events-none absolute bottom-0 left-0 h-28 w-20 text-brand-200/80" />
      <Daun className="pointer-events-none absolute bottom-0 right-0 h-28 w-20 -scale-x-100 text-brand-200/80" />

      {adaKeranjang && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 rounded-full border border-brand-100 bg-white/95 p-2 pl-4 shadow-[0_12px_30px_-10px_rgba(154,52,18,0.5)] backdrop-blur">
            <span className="relative shrink-0 text-brand-600">
              <IkonKeranjang className="h-7 w-7" />
              <span className="absolute -right-2.5 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
                {totalQty}
              </span>
            </span>
            <div className="flex-1 whitespace-nowrap border-r border-brand-100 pl-1 pr-2 leading-tight">
              <p className="text-xs text-stone-500">{list.length} produk</p>
              <p className="text-[15px] font-extrabold tabular-nums">{rupiah(totalPrice)}</p>
            </div>
            <Link href="/keranjang" className="btn-oranye h-12 shrink-0 px-4 text-sm">
              <span>
                <span className="hidden min-[380px]:inline">Lihat </span>Keranjang
              </span>
              <IkonPanahKanan className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
