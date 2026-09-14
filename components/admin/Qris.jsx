"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { IkonCentang, IkonQr, IkonSilang, IkonUnggah } from "../Ikon";

const MAKS = 2 * 1024 * 1024; // 2 MB
const JENIS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Gambar QRIS statis yang di-scan pembeli di halaman bayar.
// File masuk ke bucket publik 'toko', URL-nya disimpan di settings.qris_url.
export default function Qris() {
  const [url, setUrl] = useState(undefined); // undefined = memuat
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState(null); // [berhasil?, teks]

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "qris_url")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setPesan([false, "Tabel settings belum ada — jalankan migration-login-bayar-manual.sql dulu."]);
        setUrl(data?.value || null);
      });
  }, []);

  const unggah = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // biar file yang sama bisa dipilih ulang
    if (!file) return;
    const ext = JENIS[file.type];
    if (!ext) return setPesan([false, "Format harus PNG, JPG, atau WEBP."]);
    if (file.size > MAKS) return setPesan([false, "Ukuran maksimal 2 MB."]);

    setBusy(true);
    setPesan(null);
    // Nama unik tiap upload -> nggak perlu hapus/timpa, dan cache browser pasti dapat yang baru
    const path = `qris-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("toko").upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return setPesan([false, "Gagal upload: " + upErr.message]);
    }
    const publik = supabase.storage.from("toko").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "qris_url", value: publik, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return setPesan([false, "Gagal menyimpan: " + error.message]);
    setUrl(publik);
    setPesan([true, "QRIS baru sudah tampil di halaman bayar pembeli."]);
  };

  return (
    <div className="space-y-3 p-4">
      <section className="kartu p-4">
        <p className="flex items-center gap-2 text-lg font-extrabold">
          <IkonQr className="h-5 w-5 text-brand-600" />
          QRIS toko
        </p>
        <p className="mt-0.5 text-sm text-stone-500">
          Gambar ini yang di-scan pembeli. Pakai QRIS statis dari aplikasi bank / e-wallet tokomu.
        </p>

        <div className="mx-auto mt-4 grid w-full max-w-xs place-items-center rounded-3xl border-2 border-dashed border-brand-200 bg-white p-3">
          {url === undefined ? (
            <div className="aspect-square w-full animate-pulse rounded-2xl bg-brand-100" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="QRIS toko" className="w-full rounded-2xl" />
          ) : (
            <p className="px-4 py-12 text-center text-sm text-stone-500">
              Belum ada QRIS. Pembeli belum bisa bayar sampai kamu upload.
            </p>
          )}
        </div>

        <label
          aria-disabled={busy || undefined}
          className={`btn-oranye mt-4 h-12 w-full cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <IkonUnggah className="h-5 w-5" strokeWidth={2.4} />
          {busy ? "Mengupload…" : url ? "Ganti Gambar QRIS" : "Upload Gambar QRIS"}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={unggah} disabled={busy} className="hidden" />
        </label>

        {pesan && (
          <p
            role="status"
            className={`mt-3 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm ${
              pesan[0] ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
            }`}
          >
            {pesan[0] ? (
              <IkonCentang className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.6} />
            ) : (
              <IkonSilang className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {pesan[1]}
          </p>
        )}
        <p className="mt-3 text-xs text-stone-500">
          PNG/JPG/WEBP, maks 2 MB. Yang tampil ke pembeli selalu gambar yang terakhir diupload.
        </p>
      </section>
    </div>
  );
}
