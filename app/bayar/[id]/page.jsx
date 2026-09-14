"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { rupiah } from "../../../lib/supabase";
import { KONTAK_WA, waLink } from "../../../lib/toko";

const POLL_MS = 4000;

function Countdown({ until, onHabis }) {
  const hitung = () => new Date(until).getTime() - Date.now();
  const [sisa, setSisa] = useState(hitung);

  useEffect(() => {
    setSisa(hitung());
    const t = setInterval(() => {
      const s = hitung();
      setSisa(s);
      if (s <= 0) {
        clearInterval(t);
        onHabis();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [until]); // eslint-disable-line react-hooks/exhaustive-deps

  const detik = Math.max(0, Math.floor(sisa / 1000));
  const mm = String(Math.floor(detik / 60)).padStart(2, "0");
  const ss = String(detik % 60).padStart(2, "0");
  return (
    <span className="font-mono font-bold">
      {mm}:{ss}
    </span>
  );
}

function Selesai({ judul, pesan }) {
  return (
    <div className="m-4 rounded-2xl bg-green-50 p-6 text-center">
      <p className="text-3xl">✅</p>
      <p className="mt-2 font-bold text-green-700">{judul}</p>
      <p className="mt-1 text-sm text-green-600">{pesan}</p>
      <Link href="/" className="mt-4 inline-block font-semibold text-brand-600 underline">
        ← Kembali ke katalog
      </Link>
    </div>
  );
}

export default function Bayar() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Jalur manual (QRIS statis + upload bukti)
  const [uploading, setUploading] = useState(false);
  // Jalur otomatis (QRIS dinamis Midtrans)
  const [qr, setQr] = useState(null); // sesi Snap: { pay_url, expiry_time, amount }
  const [qrLoading, setQrLoading] = useState(false);
  const [qrHabis, setQrHabis] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pesanan/${id}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
          setItems(data.items || []);
        }
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const tandaiLunas = () => setOrder((o) => ({ ...o, sudah_bayar: true }));

  const bikinQr = useCallback(async () => {
    setQrLoading(true);
    setQrHabis(false);
    setError("");
    try {
      const res = await fetch(`/api/pesanan/${id}/qris`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data?.error || "Gagal membuat QRIS.");
      else if (data.paid) tandaiLunas();
      else setQr(data);
    } catch {
      setError("Gagal menghubungi server. Cek koneksi internetmu.");
    }
    setQrLoading(false);
  }, [id]);

  const perluQr =
    !!order && order.bayar_otomatis && !order.sudah_bayar && order.status !== "batal";

  // Buka halaman -> langsung siapkan sesi bayar (server mengembalikan sesi lama kalau masih aktif)
  useEffect(() => {
    if (perluQr && !qr) bikinQr();
  }, [perluQr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cek status berkala. Server yang tanya ke Midtrans, jadi tetap jalan walau webhook telat.
  useEffect(() => {
    if (!qr || qrHabis || order?.sudah_bayar) return;
    let berhenti = false;
    const cek = async () => {
      try {
        const res = await fetch(`/api/pesanan/${id}/qris`, { cache: "no-store" });
        const data = await res.json();
        if (berhenti || !res.ok) return;
        if (data.paid) tandaiLunas();
        else if (data.status === "nominal_beda")
          setError(`Pembayaran masuk tapi nominalnya beda. Hubungi penjual via WhatsApp ${KONTAK_WA} ya.`);
        else if (["expire", "cancel", "deny", "failure"].includes(data.status)) setQrHabis(true);
      } catch {}
    };
    cek(); // langsung, biar yang baru balik dari Midtrans nggak nunggu 4 detik
    const t = setInterval(cek, POLL_MS);
    return () => {
      berhenti = true;
      clearInterval(t);
    };
  }, [qr, qrHabis, order?.sudah_bayar, id]);

  const uploadProof = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/pesanan/${id}/bukti`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) setError(data?.error || "Gagal upload bukti.");
      else setOrder((o) => ({ ...o, sudah_upload: true, status: data.status }));
    } catch {
      setError("Gagal upload. Cek koneksi internetmu.");
    }
    setUploading(false);
    e.target.value = ""; // biar file yang sama bisa dipilih ulang kalau gagal
  };

  if (loading) return <p className="p-8 text-center text-sm text-stone-500">Memuat…</p>;
  if (!order)
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-stone-500">Pesanan tidak ditemukan.</p>
        <Link href="/" className="mt-3 inline-block font-semibold text-brand-600 underline">
          ← Kembali
        </Link>
      </div>
    );

  return (
    <main className="pb-10">
      <header className="sticky top-0 z-10 bg-brand-500 px-4 py-4 text-white shadow">
        <h1 className="text-lg font-extrabold">Pembayaran</h1>
        <p className="text-xs text-orange-100">
          Pesanan #{String(order.id).slice(0, 8)}
          {order.batch_name ? ` • ${order.batch_name}` : ""}
        </p>
      </header>

      <div className="m-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-stone-500">Ringkasan pesanan</p>
        {items.map((it) => (
          <div key={it.id} className="flex justify-between py-1 text-sm">
            <span>
              {it.product_name} × {it.qty}
            </span>
            <span className="font-semibold">{rupiah(it.price * it.qty)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-stone-100 pt-2">
          <span className="font-bold">Total</span>
          <span className="text-lg font-extrabold text-brand-700">{rupiah(order.total)}</span>
        </div>
        {order.batch_note && (
          <p className="mt-2 border-t border-stone-100 pt-2 text-xs text-stone-500">
            {order.batch_note}
          </p>
        )}
      </div>

      {order.sudah_bayar ? (
        <Selesai
          judul="Pembayaran berhasil! 🎉"
          pesan="Pesananmu sudah lunas. Kami hubungi via WhatsApp ya."
        />
      ) : order.status === "batal" ? (
        <div className="m-4 rounded-2xl bg-stone-200 p-6 text-center text-sm font-semibold text-stone-600">
          Pesanan ini sudah dibatalkan.
        </div>
      ) : order.bayar_otomatis ? (
        // ---------- QRIS lewat Midtrans Snap ----------
        <div className="m-4">
          {qrHabis ? (
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="text-3xl">⌛</p>
              <p className="mt-2 font-bold">QR sudah kedaluwarsa</p>
              <p className="mt-1 text-sm text-stone-500">Belum sempat bayar? Bikin QR baru aja.</p>
              <button
                onClick={bikinQr}
                disabled={qrLoading}
                className="mt-4 w-full rounded-2xl bg-brand-600 py-3 font-bold text-white disabled:opacity-50"
              >
                {qrLoading ? "Menyiapkan…" : "Bikin QR Baru"}
              </button>
            </div>
          ) : qr ? (
            <>
              <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                <p className="text-sm font-semibold">
                  Bayar <b className="text-brand-700">{rupiah(qr.amount)}</b> pakai QRIS
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  Selesaikan dalam <Countdown until={qr.expiry_time} onHabis={() => setQrHabis(true)} />
                </p>
                <a
                  href={qr.pay_url}
                  className="mt-4 block w-full rounded-2xl bg-brand-600 py-4 font-bold text-white shadow-lg"
                >
                  Bayar dengan QRIS →
                </a>
                <p className="mt-3 text-xs text-stone-400">
                  Kamu dibawa ke halaman pembayaran Midtrans. QR-nya bisa di-scan dari HP lain atau
                  diunduh lalu di-upload dari aplikasi e-wallet / m-banking. Setelah bayar, kamu
                  balik ke sini otomatis.
                </p>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-brand-100 px-4 py-3 text-sm font-semibold text-brand-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" />
                Menunggu pembayaran… halaman ini otomatis berubah begitu uang masuk
              </div>
            </>
          ) : (
            !error && (
              <p className="p-6 text-center text-sm text-stone-500">Menyiapkan QRIS…</p>
            )
          )}

          {error && (
            <div className="mt-3 rounded-2xl bg-red-50 p-4 text-center">
              <p className="text-sm text-red-600">{error}</p>
              {!qr && (
                <button
                  onClick={bikinQr}
                  disabled={qrLoading}
                  className="mt-3 font-semibold text-brand-600 underline disabled:opacity-50"
                >
                  Coba lagi
                </button>
              )}
            </div>
          )}
        </div>
      ) : order.sudah_upload ? (
        <Selesai
          judul="Bukti pembayaran diterima!"
          pesan="Pesananmu sedang kami cek. Kami hubungi via WhatsApp ya."
        />
      ) : (
        // ---------- QRIS statis + upload bukti (Midtrans belum diaktifkan) ----------
        <>
          <div className="m-4 rounded-2xl bg-white p-4 text-center shadow-sm">
            <p className="mb-3 text-sm font-semibold">
              Scan QRIS di bawah, bayar <b className="text-brand-700">{rupiah(order.total)}</b>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/qris.png" alt="QRIS" className="mx-auto w-full max-w-xs rounded-xl" />
          </div>

          <div className="m-4">
            <label className="block w-full cursor-pointer rounded-2xl bg-brand-600 py-4 text-center font-bold text-white shadow-lg">
              {uploading ? "Mengupload…" : "📤 Upload Bukti Pembayaran"}
              <input
                type="file"
                accept="image/*"
                onChange={uploadProof}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <p className="mt-2 text-center text-xs text-stone-400">
              Screenshot bukti transfer dari aplikasi pembayaranmu (maks 5 MB)
            </p>
          </div>
        </>
      )}

      <p className="px-4 pt-2 text-center text-xs text-stone-400">
        Ada kendala pembayaran? WhatsApp{" "}
        <a
          href={waLink(`Halo, soal pesanan #${String(order.id).slice(0, 8)}`)}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand-600 underline"
        >
          {KONTAK_WA}
        </a>
      </p>
    </main>
  );
}
