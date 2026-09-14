"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { GOOGLE_CLIENT_ID, buatNonce, masukGoogle, muatGis } from "../lib/auth";
import { IkonGoogle } from "./Ikon";

// Tombol "Masuk dengan Google" resmi (Google Identity Services) yang berjalan di domain
// kita sendiri — pembeli melihat kripik.ramcode.site, bukan alamat supabase.co.
// Token dari Google diserahkan ke Supabase lewat signInWithIdToken (+ nonce).
//
// - `onMasuk`   : dipanggil setelah sesi Supabase terbentuk (mis. pindah ke /pesanan)
// - `kembaliKe` : tujuan kalau terpaksa pakai cara cadangan (redirect lewat supabase.co)
// - `ringkas`   : tombol kecil "Masuk" (dipakai di bar katalog)
export default function TombolGoogle({ onMasuk, kembaliKe = "/", ringkas = false, className = "" }) {
  const wadah = useRef(null);
  const [status, setStatus] = useState("memuat"); // memuat | siap | proses | gagal
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const [google, nonce] = await Promise.all([muatGis(), buatNonce()]);
        if (batal || !wadah.current) return;

        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hex,
          callback: async ({ credential }) => {
            setStatus("proses");
            setPesan("");
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: credential,
              nonce: nonce.mentah,
            });
            if (error) {
              setStatus("siap");
              setPesan("Gagal masuk: " + error.message);
              return;
            }
            onMasuk?.();
          },
        });

        const opsi = {
          type: "standard",
          theme: "outline",
          shape: "pill",
          locale: "id",
          logo_alignment: "left",
          size: ringkas ? "medium" : "large",
          text: ringkas ? "signin" : "continue_with",
        };
        // Lebar tombol Google harus 200–400 px; ikut lebar wadah biar penuh di kartu
        if (!ringkas) opsi.width = Math.min(400, Math.max(200, Math.round(wadah.current.offsetWidth || 300)));
        wadah.current.innerHTML = "";
        google.accounts.id.renderButton(wadah.current, opsi);
        setStatus("siap");
      } catch (e) {
        if (!batal) {
          setStatus("gagal");
          setPesan(e.message);
        }
      }
    })();
    return () => {
      batal = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className}>
      <div className="relative">
        <div
          ref={wadah}
          className={`flex justify-center ${ringkas ? "min-h-[32px]" : "min-h-[44px]"} ${
            status === "proses" ? "pointer-events-none opacity-50" : ""
          } ${status === "gagal" ? "hidden" : ""}`}
        />
        {status === "memuat" && (
          <div
            className={`absolute inset-0 animate-pulse rounded-full bg-brand-100 ${ringkas ? "w-24" : "w-full"}`}
            aria-hidden="true"
          />
        )}
      </div>

      {status === "proses" && <p className="mt-2 text-center text-xs text-stone-500">Memproses login…</p>}

      {status === "gagal" && (
        // Cadangan: login lama lewat halaman Supabase
        <button
          type="button"
          onClick={() => masukGoogle(kembaliKe)}
          className={`inline-flex items-center justify-center gap-2 rounded-full border border-stone-200 bg-white font-bold shadow-sm transition active:scale-[0.98] ${
            ringkas ? "h-10 px-3.5 text-sm" : "h-12 w-full gap-3"
          }`}
        >
          <IkonGoogle className={ringkas ? "h-4 w-4" : "h-5 w-5"} />
          {ringkas ? "Masuk" : "Masuk dengan Google"}
        </button>
      )}

      {pesan && !ringkas && (
        <p role="alert" className="mt-2 text-center text-xs text-red-700">
          {pesan}
        </p>
      )}
    </div>
  );
}
