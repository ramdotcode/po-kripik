"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { downloadCsv, slug } from "../../lib/csv";
import { IkonCentang, IkonChevronBawah, IkonGrafik, IkonTabel, IkonUnduh } from "../Ikon";

const LABEL = {
  baru: "Baru",
  menunggu_konfirmasi: "Menunggu konfirmasi",
  lunas: "Lunas",
  diproses: "Diproses",
  selesai: "Selesai",
  batal: "Batal",
};

function OpsiEkspor({ Ikon, judul, keterangan, sibuk, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="kartu flex w-full items-center gap-4 p-4 text-left transition active:scale-[0.99] disabled:opacity-60"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-600">
        <Ikon className="h-6 w-6" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold">{sibuk ? "Menyiapkan…" : judul}</span>
        <span className="mt-0.5 block text-xs leading-snug text-stone-500">{keterangan}</span>
      </span>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm">
        <IkonUnduh className="h-4 w-4" strokeWidth={2.4} />
      </span>
    </button>
  );
}

export default function Export({ batches }) {
  const [pilih, setPilih] = useState(batches.find((b) => b.status === "buka")?.id || "semua");
  const [busy, setBusy] = useState("");
  const [pesan, setPesan] = useState(null); // { ok, teks }

  const namaFile = pilih === "semua" ? "semua-batch" : slug(batches.find((b) => b.id === pilih)?.name);

  const ambil = async () => {
    let q = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: true });
    if (pilih !== "semua") q = q.eq("batch_id", pilih);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  };

  const batchName = (id) => batches.find((b) => b.id === id)?.name || "";

  const exportPesanan = async () => {
    setBusy("pesanan");
    setPesan(null);
    try {
      const orders = await ambil();
      const rows = [];
      for (const o of orders) {
        for (const it of o.order_items || []) {
          rows.push([
            batchName(o.batch_id),
            new Date(o.created_at).toLocaleString("id-ID"),
            String(o.id).slice(0, 8),
            o.customer_name,
            // Diawali tanda kutip biar Excel tidak makan angka 0 di depan
            `'${o.phone || ""}`,
            it.product_name,
            it.price,
            it.qty,
            it.price * it.qty,
            LABEL[o.status] || o.status,
            o.paid_at
              ? `${new Date(o.paid_at).toLocaleString("id-ID")}${o.paid_via === "midtrans" ? " (QRIS otomatis)" : ""}`
              : "",
            o.notes || "",
          ]);
        }
      }
      if (rows.length === 0) {
        setPesan({ ok: false, teks: "Belum ada pesanan di batch ini." });
        setBusy("");
        return;
      }
      downloadCsv(
        `pesanan-${namaFile}.csv`,
        ["Batch", "Waktu", "Kode", "Nama", "WhatsApp", "Produk", "Harga", "Qty", "Subtotal", "Status", "Dibayar", "Catatan"],
        rows
      );
      setPesan({ ok: true, teks: `${rows.length} baris terunduh.` });
    } catch (e) {
      setPesan({ ok: false, teks: "Gagal ekspor: " + e.message });
    }
    setBusy("");
  };

  const exportRekap = async () => {
    setBusy("rekap");
    setPesan(null);
    try {
      const orders = await ambil();
      // Yang batal tidak dihitung — ini dipakai buat tahu harus produksi berapa
      const rekap = new Map();
      for (const o of orders) {
        if (o.status === "batal") continue;
        for (const it of o.order_items || []) {
          const cur = rekap.get(it.product_name) || { qty: 0, total: 0 };
          cur.qty += it.qty;
          cur.total += it.price * it.qty;
          rekap.set(it.product_name, cur);
        }
      }
      const rows = [...rekap.entries()]
        .sort((a, b) => b[1].qty - a[1].qty)
        .map(([nama, v]) => [nama, v.qty, v.total]);
      if (rows.length === 0) {
        setPesan({ ok: false, teks: "Belum ada pesanan di batch ini." });
        setBusy("");
        return;
      }
      rows.push(["TOTAL", rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)]);
      downloadCsv(`rekap-produk-${namaFile}.csv`, ["Produk", "Total Qty", "Total Rupiah"], rows);
      setPesan({ ok: true, teks: `${rows.length - 1} produk terunduh.` });
    } catch (e) {
      setPesan({ ok: false, teks: "Gagal ekspor: " + e.message });
    }
    setBusy("");
  };

  return (
    <div className="space-y-3 p-4">
      <div className="kartu space-y-1.5 p-4">
        <label htmlFor="ekspor-batch" className="text-sm font-semibold">
          Batch yang diekspor
        </label>
        <div className="relative">
          <select
            id="ekspor-batch"
            value={pilih}
            onChange={(e) => setPilih(e.target.value)}
            className="h-11 w-full appearance-none rounded-full border border-brand-100 bg-white pl-4 pr-10 text-sm font-semibold focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
          >
            <option value="semua">Semua batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.status === "buka" ? "(buka)" : ""}
              </option>
            ))}
          </select>
          <IkonChevronBawah className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
        </div>
      </div>

      <OpsiEkspor
        Ikon={IkonTabel}
        judul="Pesanan lengkap"
        keterangan="Satu baris per produk per pesanan — nama, WhatsApp, status, dan catatan."
        sibuk={busy === "pesanan"}
        disabled={!!busy}
        onClick={exportPesanan}
      />
      <OpsiEkspor
        Ikon={IkonGrafik}
        judul="Rekap per produk"
        keterangan="Total qty tiap produk — buat tahu harus bikin berapa. Pesanan batal nggak dihitung."
        sibuk={busy === "rekap"}
        disabled={!!busy}
        onClick={exportRekap}
      />

      {pesan && (
        <p
          role="status"
          className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
            pesan.ok ? "bg-green-50 text-green-800" : "bg-brand-100 text-brand-700"
          }`}
        >
          {pesan.ok && <IkonCentang className="h-4 w-4" strokeWidth={2.6} />}
          {pesan.teks}
        </p>
      )}
      <p className="text-center text-xs text-stone-500">File CSV, bisa langsung dibuka di Excel atau Google Sheets.</p>
    </div>
  );
}
