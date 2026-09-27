"use client";

import { useEffect, useState } from "react";
import { supabase, rupiah } from "../../lib/supabase";
import Export from "./Export";
import { labelMetode } from "../../lib/toko";
import { IkonChevronBawah, IkonPaket } from "../Ikon";

// Sama dengan aturan di Orders.jsx: sudah bayar = paid_at terisi ATAU salah satu status ini
const SUDAH_BAYAR = ["lunas", "diproses", "selesai"];
const sudahBayar = (o) => Boolean(o.paid_at) || SUDAH_BAYAR.includes(o.status);
const STATUS = [
  ["baru", "Belum Bayar"],
  ["menunggu_konfirmasi", "Cek Bukti"],
  ["lunas", "Sudah Bayar"],
  ["diproses", "Diproses"],
  ["selesai", "Selesai"],
  ["batal", "Batal"],
];
const HARI_MAKS = 21; // grafik harian: hari terakhir saja biar muat di HP
// Warna bagian "sudah dibayar" vs "belum" — hijau sama dengan bar di tab Pesanan,
// sisa pakai oranye muda (beda terang jauh, aman buat buta warna). Angka tetap tertulis.
const WARNA_BAYAR = "bg-green-600";
const WARNA_BELUM = "bg-brand-200";

const bungkusOf = (o) => (o.order_items || []).reduce((s, it) => s + it.qty, 0);
const tanggalKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const pendek = (n) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
    : n >= 1000
      ? `${Math.round(n / 1000)} rb`
      : String(n);

function hitung(orders) {
  const aktif = orders.filter((o) => o.status !== "batal");
  const lunas = aktif.filter(sudahBayar);
  const jumlah = (os) => os.reduce((s, o) => s + (o.total || 0), 0);

  // Pembeli unik: akun Google dulu, lalu nomor WA, lalu nama (pesanan manual tanpa WA)
  const pembeli = new Set(
    aktif.map((o) => o.user_id || (o.phone || "").replace(/\D/g, "") || (o.customer_name || "").trim().toLowerCase()),
  );

  // Rekap per produk — dasar hitung produksi
  const produk = new Map();
  for (const o of aktif) {
    const bayar = sudahBayar(o);
    for (const it of o.order_items || []) {
      const p = produk.get(it.product_name) || { nama: it.product_name, qty: 0, qtyBayar: 0, rupiah: 0, pesanan: 0 };
      p.qty += it.qty;
      if (bayar) p.qtyBayar += it.qty;
      p.rupiah += it.price * it.qty;
      p.pesanan += 1;
      produk.set(it.product_name, p);
    }
  }

  // Pesanan per hari (tanpa yang batal), hari kosong tetap ditampilkan
  const perHari = new Map();
  for (const o of aktif) {
    const k = tanggalKey(new Date(o.created_at));
    const h = perHari.get(k) || { n: 0, rupiah: 0 };
    h.n += 1;
    h.rupiah += o.total || 0;
    perHari.set(k, h);
  }
  const hari = [];
  if (aktif.length) {
    const waktu = aktif.map((o) => new Date(o.created_at).getTime());
    const akhir = new Date(Math.max(...waktu));
    const awal = new Date(Math.max(Math.min(...waktu), akhir.getTime() - (HARI_MAKS - 1) * 864e5));
    for (
      let d = new Date(awal.getFullYear(), awal.getMonth(), awal.getDate());
      d <= akhir;
      d.setDate(d.getDate() + 1)
    ) {
      hari.push({ tanggal: new Date(d), ...(perHari.get(tanggalKey(d)) || { n: 0, rupiah: 0 }) });
    }
  }

  // Uang yang sudah masuk, dipisah per cara bayar (cash di tangan vs masuk rekening/QRIS)
  const URUT = ["cash", "qris", "transfer", "midtrans"];
  const metode = new Map();
  for (const o of lunas) {
    const k = URUT.includes(o.paid_via) ? o.paid_via : "lain";
    const m = metode.get(k) || { k, label: labelMetode(k === "lain" ? null : k), n: 0, rupiah: 0 };
    m.n += 1;
    m.rupiah += o.total || 0;
    metode.set(k, m);
  }

  return {
    nilai: jumlah(aktif),
    metode: [...URUT, "lain"].filter((k) => metode.has(k)).map((k) => metode.get(k)),
    masuk: jumlah(lunas),
    nPesanan: aktif.length,
    nLunas: lunas.length,
    nBatal: orders.length - aktif.length,
    nCek: aktif.filter((o) => o.status === "menunggu_konfirmasi").length,
    bungkus: aktif.reduce((s, o) => s + bungkusOf(o), 0),
    pembeli: pembeli.size,
    produk: [...produk.values()].sort((a, b) => b.qty - a.qty || a.nama.localeCompare(b.nama, "id")),
    hari,
    status: STATUS.map(([s, label]) => {
      const os = orders.filter((o) => o.status === s);
      return { s, label, n: os.length, rupiah: jumlah(os) };
    }),
    daftar: aktif.slice().sort((a, b) => (a.customer_name || "").localeCompare(b.customer_name || "", "id")),
  };
}

function Tile({ label, nilai, sub }) {
  return (
    <div className="kartu p-3.5">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold tabular-nums leading-tight">{nilai}</p>
      {sub && <p className="mt-0.5 text-[11px] text-stone-500">{sub}</p>}
    </div>
  );
}

function Bagian({ judul, sub, children }) {
  return (
    <section className="kartu p-4">
      <h2 className="font-extrabold">{judul}</h2>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Legenda() {
  return (
    <p className="flex gap-4 text-xs text-stone-500">
      <span className="flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 rounded-sm ${WARNA_BAYAR}`} />
        Sudah dibayar
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 rounded-sm ${WARNA_BELUM}`} />
        Belum dibayar
      </span>
    </p>
  );
}

// Bar horizontal dua bagian (dibayar | belum), dipisah celah 2px
function BarBayar({ bayar, total, maks }) {
  const lebar = maks ? (total / maks) * 100 : 0;
  const porsi = total ? (bayar / total) * 100 : 0;
  return (
    <div className="h-2.5 w-full" aria-hidden="true">
      <div className="flex h-full gap-[2px]" style={{ width: `${Math.max(lebar, 2)}%` }}>
        {bayar > 0 && (
          <div
            className={`h-full rounded-l-[4px] ${WARNA_BAYAR} ${bayar === total ? "rounded-r-[4px]" : ""}`}
            style={{ width: `${porsi}%` }}
          />
        )}
        {bayar < total && (
          <div className={`h-full flex-1 rounded-r-[4px] ${WARNA_BELUM} ${bayar === 0 ? "rounded-l-[4px]" : ""}`} />
        )}
      </div>
    </div>
  );
}

function GrafikHarian({ hari }) {
  const [aktif, setAktif] = useState(null);
  const maks = Math.max(1, ...hari.map((h) => h.n));
  const puncak = hari.reduce((a, h, i) => (h.n > hari[a].n ? i : a), 0);
  const pilih = aktif ?? hari.length - 1;
  const h = hari[pilih];
  const fmt = (d) => d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div>
      {/* Baca-an: default hari terakhir, ikut berubah saat kolom disentuh/di-hover */}
      <p className="text-sm" aria-live="polite">
        <b>{fmt(h.tanggal)}</b>
        <span className="text-stone-500">
          {" "}
          · {h.n} pesanan · {rupiah(h.rupiah)}
        </span>
      </p>
      <div className="relative mt-3" onMouseLeave={() => setAktif(null)}>
        <div className="flex h-32 items-end gap-[2px] border-b border-stone-200">
          {hari.map((x, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setAktif(i)}
              onFocus={() => setAktif(i)}
              onClick={() => setAktif(i)}
              aria-label={`${fmt(x.tanggal)}: ${x.n} pesanan, ${rupiah(x.rupiah)}`}
              className="relative flex h-full flex-1 items-end justify-center"
            >
              {i === puncak && x.n > 0 && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums text-coklat-700"
                  style={{ bottom: `calc(${(x.n / maks) * 100}% + 2px)` }}
                >
                  {x.n}
                </span>
              )}
              <span
                className={`block w-full max-w-[24px] rounded-t-[4px] transition-colors ${
                  i === pilih ? "bg-brand-600" : "bg-brand-400"
                }`}
                style={{ height: x.n ? `${(x.n / maks) * 88}%` : 0 }}
              />
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-stone-400">
          <span>{hari[0].tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
          <span>{hari.at(-1).tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
        </div>
      </div>
    </div>
  );
}

export default function Rekap({ batches }) {
  const [pilih, setPilih] = useState(batches.find((b) => b.status === "buka")?.id || "semua");
  const [orders, setOrders] = useState(null); // null = memuat
  const [err, setErr] = useState("");
  const [semuaPembeli, setSemuaPembeli] = useState(false);

  useEffect(() => {
    let batal = false;
    (async () => {
      setOrders(null);
      setErr("");
      let q = supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: true });
      if (pilih !== "semua") q = q.eq("batch_id", pilih);
      const { data, error } = await q;
      if (batal) return;
      if (error) setErr("Gagal memuat data: " + error.message);
      setOrders(data || []);
    })();
    return () => {
      batal = true;
    };
  }, [pilih]);

  const r = orders ? hitung(orders) : null;
  const persen = r?.nilai ? Math.round((r.masuk / r.nilai) * 100) : 0;
  const maksQty = r ? Math.max(0, ...r.produk.map((p) => p.qty)) : 0;
  const pembeli = r ? (semuaPembeli ? r.daftar : r.daftar.slice(0, 10)) : [];

  return (
    <div className="space-y-3 p-4">
      <label className="relative block">
        <span className="sr-only">Batch</span>
        <select
          value={pilih}
          onChange={(e) => setPilih(e.target.value)}
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

      {err && <p className="rounded-2xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{err}</p>}

      {!r ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-brand-100/80" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-3xl bg-brand-100/80" />
        </>
      ) : r.nPesanan === 0 ? (
        <div className="kartu p-6 text-center">
          <IkonPaket className="mx-auto h-10 w-10 text-brand-300" />
          <p className="mt-2 font-extrabold">Belum ada pesanan</p>
          <p className="mt-1 text-sm text-stone-500">
            {r.nBatal ? `Cuma ada ${r.nBatal} pesanan batal di batch ini.` : "Rekap muncul begitu ada pesanan masuk."}
          </p>
        </div>
      ) : (
        <>
          {/* Angka utama */}
          <section className="kartu p-4" aria-label="Nilai pesanan">
            <p className="text-xs font-semibold text-stone-500">Nilai pesanan</p>
            <p className="text-3xl font-extrabold tabular-nums">{rupiah(r.nilai)}</p>
            <div
              className="mt-3 flex h-2.5 gap-[2px]"
              role="progressbar"
              aria-valuenow={persen}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Persentase sudah dibayar"
            >
              {r.masuk > 0 && <div className={`h-full rounded-[4px] ${WARNA_BAYAR}`} style={{ width: `${persen}%` }} />}
              {r.masuk < r.nilai && <div className={`h-full flex-1 rounded-[4px] ${WARNA_BELUM}`} />}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <p>
                <span className="text-stone-500">Sudah dibayar · {persen}%</span>
                <br />
                <b className="text-sm tabular-nums">{rupiah(r.masuk)}</b>
                <span className="block text-stone-500">{r.nLunas} pesanan</span>
              </p>
              <p className="text-right">
                <span className="text-stone-500">Belum dibayar</span>
                <br />
                <b className="text-sm tabular-nums">{rupiah(r.nilai - r.masuk)}</b>
                <span className="block text-stone-500">{r.nPesanan - r.nLunas} pesanan</span>
              </p>
            </div>
            {r.nCek > 0 && (
              <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                {r.nCek} bukti bayar menunggu dicek di tab Pesanan
              </p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Tile label="Pesanan" nilai={r.nPesanan} sub={r.nBatal ? `+ ${r.nBatal} batal` : "tanpa yang batal"} />
            <Tile label="Total bungkus" nilai={r.bungkus} sub={`${r.produk.length} jenis menu`} />
            <Tile label="Pembeli" nilai={r.pembeli} sub="orang berbeda" />
            <Tile label="Rata-rata" nilai={pendek(Math.round(r.nilai / r.nPesanan))} sub="per pesanan" />
          </div>

          {r.metode.length > 0 && (
            <Bagian judul="Sudah dibayar lewat" sub="Cash = uang di tangan, sisanya masuk QRIS / rekening.">
              <table className="w-full text-sm">
                <tbody>
                  {r.metode.map((m) => (
                    <tr key={m.k} className="border-b border-brand-100 last:border-0">
                      <td className="py-1.5 font-semibold">{m.label}</td>
                      <td className="py-1.5 text-right tabular-nums text-stone-500">{m.n} pesanan</td>
                      <td className="w-28 py-1.5 text-right font-bold tabular-nums">{rupiah(m.rupiah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Bagian>
          )}

          <Bagian judul="Per menu" sub="Jumlah bungkus yang harus disiapkan. Pesanan batal nggak dihitung.">
            <Legenda />
            <ul className="mt-3 space-y-3">
              {r.produk.map((p) => (
                <li key={p.nama}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 font-semibold leading-tight">{p.nama}</span>
                    <span className="shrink-0 font-extrabold tabular-nums">{p.qty}</span>
                  </div>
                  <div className="mt-1">
                    <BarBayar bayar={p.qtyBayar} total={p.qty} maks={maksQty} />
                  </div>
                  <p className="mt-0.5 flex justify-between text-[11px] tabular-nums text-stone-500">
                    <span>
                      {p.qtyBayar} dibayar · {p.qty - p.qtyBayar} belum
                    </span>
                    <span>{rupiah(p.rupiah)}</span>
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-dashed border-brand-200 pt-2 text-sm font-extrabold tabular-nums">
              <span>Total</span>
              <span>
                {r.bungkus} bungkus · {rupiah(r.nilai)}
              </span>
            </p>
          </Bagian>

          {r.hari.length > 1 && (
            <Bagian
              judul="Pesanan per hari"
              sub={`Sentuh kolom buat lihat detail${r.hari.length >= HARI_MAKS ? ` · ${HARI_MAKS} hari terakhir` : ""}.`}
            >
              <GrafikHarian hari={r.hari} />
            </Bagian>
          )}

          <Bagian judul="Status pesanan">
            <table className="w-full text-sm">
              <tbody>
                {r.status
                  .filter((s) => s.n > 0)
                  .map((s) => (
                    <tr key={s.s} className="border-b border-brand-100 last:border-0">
                      <td className="py-1.5">{s.label}</td>
                      <td className="py-1.5 text-right font-bold tabular-nums">{s.n}</td>
                      <td className="w-28 py-1.5 text-right tabular-nums text-stone-500">{rupiah(s.rupiah)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Bagian>

          <Bagian judul="Per pembeli" sub="Urut nama — buat cek saat mengantar.">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-stone-500">
                  <th className="pb-1 font-semibold">Nama</th>
                  <th className="pb-1 text-right font-semibold">Bks</th>
                  <th className="pb-1 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {pembeli.map((o) => (
                  <tr key={o.id} className="border-t border-brand-100 align-top">
                    <td className="py-1.5 pr-2">
                      <span className="font-semibold">{o.customer_name}</span>
                      <span className="block text-[11px] leading-snug text-stone-500">
                        {(o.order_items || []).map((it) => `${it.qty}× ${it.product_name}`).join(", ")}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{bungkusOf(o)}</td>
                    <td className="py-1.5 pl-2 text-right">
                      <span className="block tabular-nums">{rupiah(o.total)}</span>
                      <span className={`text-[11px] font-bold ${sudahBayar(o) ? "text-green-700" : "text-stone-500"}`}>
                        {sudahBayar(o)
                          ? `✓ ${["cash", "qris", "transfer"].includes(o.paid_via) ? labelMetode(o.paid_via) : o.paid_via === "midtrans" ? "QRIS" : "Dibayar"}`
                          : o.status === "menunggu_konfirmasi"
                            ? "Cek bukti"
                            : "Belum"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.daftar.length > 10 && (
              <button
                type="button"
                onClick={() => setSemuaPembeli((v) => !v)}
                className="btn-lembut mt-3 h-10 w-full text-sm"
              >
                {semuaPembeli ? "Tampilkan lebih sedikit" : `Lihat semua ${r.daftar.length} pesanan`}
              </button>
            )}
          </Bagian>
        </>
      )}

      <div className="pt-3">
        <h2 className="px-1 font-extrabold">Unduh CSV</h2>
        <p className="px-1 text-xs text-stone-500">Kalau perlu diolah di Excel / Google Sheets.</p>
      </div>
      <Export batches={batches} pilih={pilih} />
    </div>
  );
}
