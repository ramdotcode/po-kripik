"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, rupiah } from "../../lib/supabase";
import { keluar, masukGoogle, useSesi } from "../../lib/auth";
import { FooterWa, HeaderHalaman, Logo } from "../../components/Brand";
import { IkonChevronKanan, IkonGoogle, IkonKeluar, IkonPanahKanan } from "../../components/Ikon";

const SUDAH_BAYAR = ["lunas", "diproses", "selesai"];

// Status dari sisi pembeli
function statusPembeli(o) {
  if (o.status === "batal") return ["Dibatalkan", "bg-stone-200 text-stone-500", false];
  if (o.status === "selesai") return ["Selesai", "bg-green-600 text-white", false];
  if (o.status === "diproses") return ["Diproses", "bg-sky-100 text-sky-800", false];
  if (o.paid_at || SUDAH_BAYAR.includes(o.status)) return ["Sudah bayar", "bg-green-100 text-green-700", false];
  if (o.status === "menunggu_konfirmasi") return ["Bukti dicek", "bg-amber-100 text-amber-800", false];
  if (o.proof_note) return ["Bukti ditolak", "bg-red-50 text-red-700", true];
  return ["Belum bayar", "bg-brand-100 text-brand-700", true];
}

export default function PesananSaya() {
  const sesi = useSesi();
  const uid = sesi?.user?.id;
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState("");
  const [kodeAkun, setKodeAkun] = useState(null);

  // RLS: pembeli cuma bisa baca pesanan miliknya sendiri
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, total, kode_unik, status, paid_at, proof_note, batches(name), order_items(product_name, qty)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) setErr("Gagal memuat pesanan: " + error.message);
      setOrders(data || []);
      // Kode unik akun (RLS: cuma milik sendiri). Belum ada = belum pernah pesan.
      const { data: ku } = await supabase.from("kode_unik").select("kode").eq("user_id", uid).maybeSingle();
      setKodeAkun(ku?.kode || null);
    })();
  }, [uid]);

  if (sesi === undefined)
    return (
      <main className="space-y-4 px-4 pt-5" aria-busy="true">
        <div className="h-12 w-48 animate-pulse rounded-2xl bg-brand-100" />
        <div className="h-40 animate-pulse rounded-3xl bg-brand-100/80" />
      </main>
    );

  if (!sesi)
    return (
      <main className="pb-10">
        <HeaderHalaman judul="Pesanan Saya" kembali="/" />
        <div className="kartu mx-4 mt-6 p-6 text-center">
          <Logo className="mx-auto h-16 w-16" />
          <p className="mt-3 text-lg font-extrabold">Masuk buat lihat pesananmu</p>
          <p className="mt-1 text-sm text-stone-500">
            Semua pesanan dan status bayarnya tersimpan di akun Google-mu.
          </p>
          <button
            type="button"
            onClick={() => masukGoogle("/pesanan")}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-stone-200 bg-white font-bold shadow-sm transition active:scale-[0.98]"
          >
            <IkonGoogle className="h-5 w-5" />
            Masuk dengan Google
          </button>
          <p className="mt-2 text-xs text-stone-400">Dengan masuk, kamu setuju dengan <Link href="/privasi" className="underline underline-offset-2">Kebijakan Privasi</Link>.</p>
        </div>
      </main>
    );

  return (
    <main className="pb-10">
      <HeaderHalaman judul="Pesanan Saya" sub={sesi.user.email} kembali="/" />

      <div className="space-y-3 px-4 pt-4">
        {kodeAkun && (
          <div className="kartu flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm leading-tight">
              <b>Kode unik akunmu</b>
              <span className="block text-xs text-stone-500">Selalu jadi 3 digit terakhir nominal transfer</span>
            </p>
            <span className="rounded-xl bg-brand-100 px-3 py-1.5 font-mono text-lg font-extrabold text-brand-700">
              {String(kodeAkun).padStart(3, "0")}
            </span>
          </div>
        )}
        {err && (
          <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {err}
          </p>
        )}

        {orders === null ? (
          <>
            <div className="h-36 animate-pulse rounded-3xl bg-brand-100/80" />
            <div className="h-36 animate-pulse rounded-3xl bg-brand-100/80" />
          </>
        ) : orders.length === 0 ? (
          <div className="px-6 pt-8 text-center">
            <Logo className="mx-auto h-20 w-20" />
            <p className="mt-3 text-lg font-extrabold">Belum ada pesanan</p>
            <p className="mt-1 text-sm text-stone-500">Pesanan yang kamu buat bakal muncul di sini.</p>
            <Link href="/" className="btn-oranye mt-5 h-12 px-6">
              Pilih camilan <IkonPanahKanan className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const [label, warna, perluBayar] = statusPembeli(o);
              return (
                <li key={o.id}>
                  <Link href={`/bayar/${o.id}`} className="kartu block p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-coklat-700">#{String(o.id).slice(0, 8)}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${warna}`}>{label}</span>
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {new Date(o.created_at).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {o.batches?.name ? ` · ${o.batches.name}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-lg font-extrabold tabular-nums text-brand-700">{rupiah(o.total + (o.kode_unik || 0))}</p>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-coklat-700">
                      {(o.order_items || []).map((it) => `${it.qty}× ${it.product_name}`).join(", ")}
                    </p>
                    {o.status === "baru" && o.proof_note && (
                      <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-700">
                        Bukti ditolak: {o.proof_note}
                      </p>
                    )}
                    <p
                      className={`mt-3 flex items-center justify-end gap-1 text-sm font-bold ${
                        perluBayar ? "text-brand-600" : "text-stone-400"
                      }`}
                    >
                      {perluBayar ? "Bayar & upload bukti" : "Lihat detail"}
                      <IkonChevronKanan className="h-4 w-4" />
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="pt-2 text-center">
          <button type="button" onClick={keluar} className="btn-lembut h-10 px-4 text-sm">
            <IkonKeluar className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </div>

      <FooterWa className="pt-6" teks="Ada pertanyaan? WhatsApp" pesan="Halo, mau tanya soal pesananku" />
    </main>
  );
}
