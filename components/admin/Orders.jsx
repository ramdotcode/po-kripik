"use client";

import { useEffect, useState } from "react";
import { supabase, rupiah } from "../../lib/supabase";
import { waPembeli } from "../../lib/toko";
import { Logo } from "../Brand";
import {
  IkonCari,
  IkonCentang,
  IkonChevronBawah,
  IkonGambar,
  IkonLuar,
  IkonTutup,
  IkonWhatsApp,
} from "../Ikon";

const STATUSES = ["baru", "menunggu_konfirmasi", "lunas", "diproses", "selesai", "batal"];
const STATUS = {
  baru: ["Baru", "bg-brand-100 text-brand-700"],
  menunggu_konfirmasi: ["Cek Bukti", "bg-amber-100 text-amber-800"],
  lunas: ["Lunas", "bg-green-100 text-green-700"],
  diproses: ["Diproses", "bg-sky-100 text-sky-800"],
  selesai: ["Selesai", "bg-green-600 text-white"],
  batal: ["Batal", "bg-stone-200 text-stone-500"],
};
// Sama dengan aturan /api/pesanan/[id]: sudah bayar = paid_at terisi ATAU salah satu status ini
const SUDAH_BAYAR = ["lunas", "diproses", "selesai"];
const sudahBayar = (o) => Boolean(o.paid_at) || SUDAH_BAYAR.includes(o.status);
const kodeOf = (o) => String(o.id).slice(0, 8);
const jumlahkan = (os) => os.reduce((s, o) => s + (o.total || 0), 0);

// Pratinjau bukti transfer. Bucket 'bukti' privat, jadi pakai link sementara (5 menit).
function ModalBukti({ order, onTutup, onLunas }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const path = order.payment_proof_url;
    if (path.startsWith("http")) return setUrl(path);
    supabase.storage
      .from("bukti")
      .createSignedUrl(path, 300)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) setErr("Gagal membuka bukti: " + (error?.message || "?"));
        else setUrl(data.signedUrl);
      });
  }, [order]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onTutup();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onTutup]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Bukti bayar ${order.customer_name}`}
      onClick={onTutup}
      className="fixed inset-0 z-50 flex items-end justify-center bg-coklat-900/60 p-3 sm:items-center"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-extrabold">Bukti bayar</p>
            <p className="truncate text-xs text-stone-500">
              {order.customer_name} · #{kodeOf(order)} · <b className="text-coklat-900">{rupiah(order.total)}</b>
            </p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50"
          >
            <IkonTutup className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid min-h-[12rem] place-items-center overflow-hidden rounded-2xl bg-stone-100">
          {err ? (
            <p className="p-4 text-center text-sm text-red-700">{err}</p>
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Bukti pembayaran" className="max-h-[60vh] w-full object-contain" />
          ) : (
            <p className="text-sm text-stone-500">Memuat…</p>
          )}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Cocokkan nominal di bukti dengan total {rupiah(order.total)}. File HEIC mungkin cuma bisa dibuka lewat
          “Ukuran penuh”.
        </p>

        <div className="mt-3 flex gap-2">
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="btn-lembut h-11 flex-1 text-sm">
              <IkonLuar className="h-4 w-4" />
              Ukuran penuh
            </a>
          )}
          {order.status === "menunggu_konfirmasi" && (
            <button type="button" onClick={onLunas} className="btn-oranye h-11 flex-1 text-sm">
              <IkonCentang className="h-4 w-4" strokeWidth={2.6} />
              Tandai Lunas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BadgeBayar({ o }) {
  if (o.status === "batal") return null;
  const [teks, warna] =
    o.paid_at && o.paid_via === "midtrans"
      ? ["Lunas otomatis (QRIS)", "bg-green-100 text-green-700"]
      : sudahBayar(o)
      ? ["Sudah dibayar", "bg-green-100 text-green-700"]
      : o.status === "menunggu_konfirmasi"
      ? ["Bukti masuk", "bg-amber-100 text-amber-800"]
      : ["Belum bayar", "bg-stone-100 text-stone-500"];
  return <span className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-bold ${warna}`}>{teks}</span>;
}

export default function Orders({ batches }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");
  const [status, setStatusFilter] = useState("semua");
  const [cari, setCari] = useState("");
  const [simpan, setSimpan] = useState({}); // id -> "…" | "ok"
  const [bukti, setBukti] = useState(null); // pesanan yang buktinya dibuka

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (filter !== "semua") q = q.eq("batch_id", filter);
      const { data } = await q;
      setOrders(data || []);
      setLoading(false);
    })();
  }, [filter]);

  const setStatus = async (id, baru) => {
    const o = orders.find((x) => x.id === id);
    if (!o || o.status === baru) return;
    if (baru === "batal" && !window.confirm(`Batalkan pesanan ${o.customer_name} (#${kodeOf(o)})?`)) return;

    setOrders((os) => os.map((x) => (x.id === id ? { ...x, status: baru } : x)));
    setSimpan((s) => ({ ...s, [id]: "…" }));
    const { error } = await supabase.from("orders").update({ status: baru }).eq("id", id);
    if (error) {
      setOrders((os) => os.map((x) => (x.id === id ? { ...x, status: o.status } : x)));
      setSimpan((s) => ({ ...s, [id]: null }));
      return alert("Gagal menyimpan status: " + error.message);
    }
    setSimpan((s) => ({ ...s, [id]: "ok" }));
    setTimeout(() => setSimpan((s) => (s[id] === "ok" ? { ...s, [id]: null } : s)), 1500);
  };

  const batchName = (id) => batches.find((b) => b.id === id)?.name || "—";

  // Ringkasan dihitung dari batch terpilih, tanpa yang batal
  const aktif = orders.filter((o) => o.status !== "batal");
  const nilai = jumlahkan(aktif);
  const masuk = jumlahkan(aktif.filter(sudahBayar));
  const persen = nilai ? Math.round((masuk / nilai) * 100) : 0;
  const nBatal = orders.length - aktif.length;

  const hitung = (s) => orders.filter((o) => o.status === s).length;
  const kata = cari.trim().toLowerCase();
  const angka = kata.replace(/\D/g, "");
  const tampil = orders.filter((o) => {
    if (status !== "semua" && o.status !== status) return false;
    if (!kata) return true;
    return (
      (o.customer_name || "").toLowerCase().includes(kata) ||
      kodeOf(o).includes(kata.replace(/^#/, "")) ||
      (angka.length >= 3 && (o.phone || "").replace(/\D/g, "").includes(angka))
    );
  });

  return (
    <div className="space-y-3 p-4">
      <label className="relative block">
        <span className="sr-only">Batch</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-11 w-full appearance-none rounded-full border border-brand-100 bg-white pl-4 pr-10 text-sm font-semibold shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
        >
          <option value="semua">Semua batch</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.status === "buka" ? "(buka)" : ""}
            </option>
          ))}
        </select>
        <IkonChevronBawah className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
      </label>

      {loading ? (
        <>
          <div className="h-32 animate-pulse rounded-3xl bg-brand-100/80" />
          <div className="h-56 animate-pulse rounded-3xl bg-brand-100/80" />
          <div className="h-56 animate-pulse rounded-3xl bg-brand-100/80" />
        </>
      ) : orders.length === 0 ? (
        <div className="px-6 pt-10 text-center">
          <Logo className="mx-auto h-20 w-20" />
          <p className="mt-3 text-lg font-extrabold">Belum ada pesanan</p>
          <p className="mt-1 text-sm text-stone-500">Pesanan baru dari pembeli bakal muncul di sini.</p>
        </div>
      ) : (
        <>
          <section className="kartu p-4" aria-label="Ringkasan">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-stone-500">Nilai pesanan</p>
                <p className="text-2xl font-extrabold tabular-nums">{rupiah(nilai)}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold tabular-nums">{aktif.length}</p>
                <p className="text-xs text-stone-500">
                  pesanan{nBatal ? ` · ${nBatal} batal` : ""}
                </p>
              </div>
            </div>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-brand-100"
              role="progressbar"
              aria-valuenow={persen}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Persentase sudah dibayar"
            >
              <div className="h-full rounded-full bg-green-500" style={{ width: `${persen}%` }} />
            </div>
            <p className="mt-1.5 flex justify-between gap-2 text-xs">
              <span className="font-semibold text-green-700">Sudah dibayar {rupiah(masuk)}</span>
              <span className="text-stone-500">Belum {rupiah(nilai - masuk)}</span>
            </p>
          </section>

          <label className="relative block">
            <span className="sr-only">Cari pesanan</span>
            <IkonCari className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama, kode, atau no. WA"
              className="input h-11 rounded-full py-0 pl-10"
            />
          </label>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter status">
            {["semua", ...STATUSES].map((s) => {
              const on = status === s;
              const n = s === "semua" ? orders.length : hitung(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStatusFilter(s)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition ${
                    on ? "bg-coklat-900 text-white" : "border border-brand-100 bg-white text-coklat-700"
                  }`}
                >
                  {s === "semua" ? "Semua" : STATUS[s][0]}
                  <span className={`tabular-nums ${on ? "text-white/70" : "text-stone-400"}`}>{n}</span>
                </button>
              );
            })}
          </div>

          {tampil.length === 0 ? (
            <div className="kartu p-6 text-center">
              <p className="font-bold">Nggak ada pesanan yang cocok</p>
              <button
                type="button"
                onClick={() => {
                  setCari("");
                  setStatusFilter("semua");
                }}
                className="btn-lembut mt-3 h-10 px-4 text-sm"
              >
                Hapus filter
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {tampil.map((o) => {
                const kode = kodeOf(o);
                return (
                  <li key={o.id} className={`kartu p-4 ${o.status === "batal" ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-extrabold">{o.customer_name}</span>
                          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] text-coklat-700 ring-1 ring-brand-100">
                            #{kode}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {new Date(o.created_at).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {batchName(o.batch_id)}
                        </p>
                      </div>
                      <p className="shrink-0 text-lg font-extrabold tabular-nums text-brand-700">{rupiah(o.total)}</p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <a
                        href={waPembeli(o.phone, `Halo ${o.customer_name}, soal pesanan #${kode} PO Kripik`)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-green-50 px-3 text-xs font-bold text-green-700 ring-1 ring-green-200"
                      >
                        <IkonWhatsApp className="h-4 w-4" />
                        {o.phone}
                      </a>
                      <BadgeBayar o={o} />
                    </div>

                    <ul className="mt-3 space-y-1 border-t border-dashed border-brand-200 pt-3 text-sm">
                      {(o.order_items || []).map((it) => (
                        <li key={it.id} className="flex justify-between gap-3">
                          <span>
                            <b className="tabular-nums">{it.qty}×</b> {it.product_name}
                          </span>
                          <span className="shrink-0 tabular-nums text-stone-500">{rupiah(it.price * it.qty)}</span>
                        </li>
                      ))}
                    </ul>
                    {o.notes && (
                      <p className="mt-2 rounded-2xl bg-brand-50 px-3 py-2 text-xs italic text-coklat-700">
                        “{o.notes}”
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="relative min-w-[9rem] flex-1">
                        <span className="sr-only">Status pesanan {o.customer_name}</span>
                        <select
                          value={o.status}
                          onChange={(e) => setStatus(o.id, e.target.value)}
                          className={`h-10 w-full appearance-none rounded-full pl-4 pr-9 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-brand-100 ${STATUS[o.status]?.[1] || ""}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS[s][0]}
                            </option>
                          ))}
                        </select>
                        <IkonChevronBawah className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                      </label>
                      {o.payment_proof_url && (
                        <button type="button" onClick={() => setBukti(o)} className="btn-lembut h-10 px-4 text-sm">
                          <IkonGambar className="h-4 w-4" />
                          Lihat Bukti
                        </button>
                      )}
                      {o.status === "menunggu_konfirmasi" && (
                        <button
                          type="button"
                          onClick={() => setStatus(o.id, "lunas")}
                          className="btn-oranye h-10 px-4 text-sm"
                        >
                          <IkonCentang className="h-4 w-4" strokeWidth={2.6} />
                          Tandai Lunas
                        </button>
                      )}
                    </div>
                    {simpan[o.id] && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-green-700" role="status">
                        {simpan[o.id] === "ok" ? (
                          <>
                            <IkonCentang className="h-3.5 w-3.5" strokeWidth={2.6} />
                            Status tersimpan
                          </>
                        ) : (
                          <span className="text-stone-500">Menyimpan…</span>
                        )}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {bukti && (
        <ModalBukti
          order={bukti}
          onTutup={() => setBukti(null)}
          onLunas={() => {
            setStatus(bukti.id, "lunas");
            setBukti(null);
          }}
        />
      )}
    </div>
  );
}
