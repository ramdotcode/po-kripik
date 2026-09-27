"use client";

import { useEffect, useState } from "react";
import { supabase, rupiah } from "../../lib/supabase";
import { labelMetode, METODE_BAYAR, waPembeli } from "../../lib/toko";
import {
  IkonCentang,
  IkonChevronBawah,
  IkonMinus,
  IkonPlus,
  IkonSalin,
  IkonSilang,
  IkonTutup,
  IkonWhatsApp,
} from "../Ikon";

// Urutan sama dengan katalog: urutan poster dulu, sisanya abjad
const posisi = (p) => p.sort_order ?? Number.MAX_SAFE_INTEGER;
const urutkan = (ps) => ps.slice().sort((a, b) => posisi(a) - posisi(b) || a.name.localeCompare(b.name, "id"));

// Pesanan manual (dari WA / langsung) yang diisi admin sendiri. Tanpa akun pembeli (user_id kosong),
// jadi link /bayar/[id] bisa dibuka siapa saja yang pegang link-nya. Tanpa kode unik.
// Insert langsung dari browser: RLS "pesanan admin" mengizinkan admin menulis orders & order_items.
export default function TambahPesanan({ batches, batchAwal, onTutup, onTersimpan }) {
  const [produk, setProduk] = useState(null); // null = memuat
  const [batchId, setBatchId] = useState(
    () => batchAwal || batches.find((b) => b.status === "buka")?.id || batches[0]?.id || "",
  );
  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [catatan, setCatatan] = useState("");
  const [qty, setQty] = useState({}); // product_id -> jumlah
  const [lunas, setLunas] = useState(false);
  const [caraBayar, setCaraBayar] = useState(null); // cash/qris/transfer — wajib kalau sudah bayar
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hasil, setHasil] = useState(null); // pesanan yang baru tersimpan
  const [disalin, setDisalin] = useState(false);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) setErr("Gagal memuat menu: " + error.message);
        setProduk(urutkan(data || []));
      });
  }, []);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && !busy && onTutup();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busy, onTutup]);

  const ubahQty = (id, d) =>
    setQty((q) => {
      const n = Math.min(999, Math.max(0, (q[id] || 0) + d));
      const { [id]: _, ...sisa } = q;
      return n ? { ...sisa, [id]: n } : sisa;
    });

  const dipilih = (produk || []).filter((p) => qty[p.id]);
  const total = dipilih.reduce((s, p) => s + p.price * qty[p.id], 0);
  const jumlah = dipilih.reduce((s, p) => s + qty[p.id], 0);

  const simpan = async (e) => {
    e.preventDefault();
    const n = nama.trim().replace(/\s+/g, " ");
    const phone = wa.trim();
    if (!batchId) return setErr("Pilih batch-nya dulu.");
    if (!n) return setErr("Nama pembeli wajib diisi.");
    if (phone && !/^[0-9+\-\s()]{8,20}$/.test(phone)) return setErr("Nomor WhatsApp tidak valid.");
    if (!dipilih.length) return setErr("Pilih minimal 1 menu.");
    if (lunas && !caraBayar) return setErr("Pilih bayarnya pakai Cash, QRIS, atau Transfer.");

    setBusy(true);
    setErr("");
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_name: n,
        phone, // kolom wajib (not null) — boleh kosong untuk pesanan langsung
        notes: catatan.trim() || null,
        total,
        status: lunas ? "lunas" : "baru",
        batch_id: batchId,
        ...(lunas ? { paid_at: new Date().toISOString(), paid_via: caraBayar } : {}),
      })
      .select("id")
      .single();
    if (error) {
      setBusy(false);
      return setErr("Gagal membuat pesanan: " + error.message);
    }

    const { error: itemErr } = await supabase.from("order_items").insert(
      dipilih.map((p) => ({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        price: p.price,
        qty: qty[p.id],
      })),
    );
    if (itemErr) {
      // Jangan tinggalkan pesanan tanpa item
      await supabase.from("orders").delete().eq("id", order.id);
      setBusy(false);
      return setErr("Gagal menyimpan item: " + itemErr.message);
    }

    setBusy(false);
    setHasil({ id: order.id, nama: n, phone, total, lunas, caraBayar });
    onTersimpan(batchId);
  };

  if (hasil) {
    const kode = String(hasil.id).slice(0, 8);
    const link = `${window.location.origin}/bayar/${hasil.id}`;
    const pesanWa =
      `Halo ${hasil.nama}, pesanan PO Kripik kamu sudah dicatat (#${kode}), total ${rupiah(hasil.total)}.` +
      `\n\nBayar lewat QRIS & upload bukti di sini:\n${link}`;
    const salin = async () => {
      try {
        await navigator.clipboard.writeText(link);
        setDisalin(true);
        setTimeout(() => setDisalin(false), 1500);
      } catch {
        window.prompt("Salin link ini:", link);
      }
    };
    return (
      <Bingkai label="Pesanan tersimpan" onTutup={onTutup}>
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100 text-green-700">
            <IkonCentang className="h-7 w-7" strokeWidth={2.6} />
          </span>
          <p className="mt-3 text-lg font-extrabold">Pesanan tersimpan</p>
          <p className="mt-1 text-sm text-stone-500">
            {hasil.nama} · #{kode} · <b className="text-coklat-900">{rupiah(hasil.total)}</b>
          </p>
          <p className="mt-1 text-xs font-semibold text-stone-500">
            {hasil.lunas ? `Dicatat sudah bayar · ${labelMetode(hasil.caraBayar)}` : "Dicatat belum bayar"}
          </p>
        </div>

        {!hasil.lunas && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-stone-500">
              Pembeli bisa bayar & upload bukti sendiri lewat link ini (tanpa login):
            </p>
            {hasil.phone && (
              <a
                href={waPembeli(hasil.phone, pesanWa)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-green-600 text-sm font-bold text-white"
              >
                <IkonWhatsApp className="h-5 w-5" />
                Kirim link bayar ke WA
              </a>
            )}
            <button type="button" onClick={salin} className="btn-lembut h-11 w-full text-sm">
              {disalin ? <IkonCentang className="h-4 w-4" strokeWidth={2.6} /> : <IkonSalin className="h-4 w-4" />}
              {disalin ? "Link tersalin" : "Salin link bayar"}
            </button>
          </div>
        )}

        <button type="button" onClick={onTutup} className="btn-oranye mt-3 h-12 w-full">
          Selesai
        </button>
      </Bingkai>
    );
  }

  return (
    <Bingkai label="Tambah pesanan" onTutup={() => !busy && onTutup()}>
      <form onSubmit={simpan}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-extrabold">Tambah pesanan</p>
            <p className="text-xs text-stone-500">Buat pesanan yang masuk lewat WA / langsung.</p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            disabled={busy}
            aria-label="Tutup"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50"
          >
            <IkonTutup className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold">Batch</span>
          <span className="relative block">
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="input appearance-none pr-10"
            >
              {batches.length === 0 && <option value="">Belum ada batch</option>}
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.status === "buka" ? "(buka)" : "(tutup)"}
                </option>
              ))}
            </select>
            <IkonChevronBawah className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
          </span>
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">Nama pembeli</span>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={120}
            placeholder="mis. Bu Rina"
            className="input"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">
            No. WhatsApp <span className="font-normal text-stone-400">(opsional)</span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={wa}
            onChange={(e) => setWa(e.target.value)}
            maxLength={20}
            placeholder="08xxxxxxxxxx"
            className="input"
          />
        </label>

        <fieldset className="mt-4">
          <legend className="mb-1 flex w-full justify-between text-sm font-semibold">
            Menu
            {jumlah > 0 && <span className="text-xs font-bold text-brand-700">{jumlah} bungkus</span>}
          </legend>
          {produk === null ? (
            <div className="h-40 animate-pulse rounded-2xl bg-brand-100/80" />
          ) : produk.length === 0 ? (
            <p className="rounded-2xl bg-brand-50 px-3 py-3 text-sm text-stone-500">Belum ada menu aktif.</p>
          ) : (
            <ul className="divide-y divide-brand-100 rounded-2xl border border-brand-100">
              {produk.map((p) => {
                const n = qty[p.id] || 0;
                return (
                  <li key={p.id} className={`flex items-center gap-3 px-3 py-2 ${n ? "bg-brand-50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-tight">{p.name}</p>
                      <p className="text-xs tabular-nums text-stone-500">
                        {rupiah(p.price)}
                        {p.weight ? ` · ${p.weight}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => ubahQty(p.id, -1)}
                        disabled={!n}
                        aria-label={`Kurangi ${p.name}`}
                        className="grid h-9 w-9 place-items-center rounded-full bg-white ring-1 ring-brand-200 disabled:opacity-30"
                      >
                        <IkonMinus className="h-4 w-4" />
                      </button>
                      <span className="w-7 text-center text-sm font-extrabold tabular-nums">{n}</span>
                      <button
                        type="button"
                        onClick={() => ubahQty(p.id, 1)}
                        aria-label={`Tambah ${p.name}`}
                        className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white"
                      >
                        <IkonPlus className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">
            Catatan <span className="font-normal text-stone-400">(opsional)</span>
          </span>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="mis. pesan lewat WA, ambil hari Jumat"
            className="input"
          />
        </label>

        <fieldset className="mt-3">
          <legend className="mb-1 text-sm font-semibold">Pembayaran</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              [false, "Belum bayar"],
              [true, "Sudah bayar"],
            ].map(([nilai, teks]) => (
              <button
                key={teks}
                type="button"
                aria-pressed={lunas === nilai}
                onClick={() => setLunas(nilai)}
                className={`h-11 rounded-full text-sm font-bold transition ${
                  lunas === nilai
                    ? nilai
                      ? "bg-green-600 text-white"
                      : "bg-coklat-900 text-white"
                    : "border border-brand-100 bg-white text-coklat-700"
                }`}
              >
                {teks}
              </button>
            ))}
          </div>
          {lunas && (
            <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Cara bayar">
              {METODE_BAYAR.map(([nilai, teks]) => (
                <button
                  key={nilai}
                  type="button"
                  aria-pressed={caraBayar === nilai}
                  onClick={() => setCaraBayar(nilai)}
                  className={`h-11 rounded-full text-sm font-bold transition ${
                    caraBayar === nilai ? "bg-green-600 text-white" : "bg-green-50 text-green-800 ring-1 ring-green-200"
                  }`}
                >
                  {teks}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        {err && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            <IkonSilang className="mt-0.5 h-4 w-4 shrink-0" />
            {err}
          </p>
        )}

        <div className="sticky -bottom-4 -mx-4 mt-4 border-t border-brand-100 bg-white px-4 pb-4 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold">Total</span>
            <span className="text-xl font-extrabold tabular-nums text-brand-700">{rupiah(total)}</span>
          </div>
          <button disabled={busy || !produk?.length} className="btn-oranye h-12 w-full">
            {busy ? "Menyimpan…" : "Simpan Pesanan"}
          </button>
        </div>
      </form>
    </Bingkai>
  );
}

function Bingkai({ label, onTutup, children }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onTutup}
      className="fixed inset-0 z-50 flex items-end justify-center bg-coklat-900/60 p-3 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}
