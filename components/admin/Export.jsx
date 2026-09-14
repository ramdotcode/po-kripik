"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { downloadCsv, slug } from "../../lib/csv";

const LABEL = {
  baru: "Baru",
  menunggu_konfirmasi: "Menunggu konfirmasi",
  lunas: "Lunas",
  diproses: "Diproses",
  selesai: "Selesai",
  batal: "Batal",
};

export default function Export({ batches }) {
  const [pilih, setPilih] = useState(batches.find((b) => b.status === "buka")?.id || "semua");
  const [busy, setBusy] = useState("");
  const [pesan, setPesan] = useState("");

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
    setPesan("");
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
        setPesan("Belum ada pesanan di batch ini.");
        setBusy("");
        return;
      }
      downloadCsv(
        `pesanan-${namaFile}.csv`,
        ["Batch", "Waktu", "Kode", "Nama", "WhatsApp", "Produk", "Harga", "Qty", "Subtotal", "Status", "Dibayar", "Catatan"],
        rows
      );
      setPesan(`✅ ${rows.length} baris terunduh.`);
    } catch (e) {
      setPesan("Gagal ekspor: " + e.message);
    }
    setBusy("");
  };

  const exportRekap = async () => {
    setBusy("rekap");
    setPesan("");
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
        setPesan("Belum ada pesanan di batch ini.");
        setBusy("");
        return;
      }
      rows.push(["TOTAL", rows.reduce((s, r) => s + r[1], 0), rows.reduce((s, r) => s + r[2], 0)]);
      downloadCsv(`rekap-produk-${namaFile}.csv`, ["Produk", "Total Qty", "Total Rupiah"], rows);
      setPesan(`✅ ${rows.length - 1} produk terunduh.`);
    } catch (e) {
      setPesan("Gagal ekspor: " + e.message);
    }
    setBusy("");
  };

  return (
    <div className="space-y-3 p-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-stone-500">Batch yang diekspor</p>
        <select
          value={pilih}
          onChange={(e) => setPilih(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="semua">Semua batch</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.status === "buka" ? "(buka)" : ""}
            </option>
          ))}
        </select>
      </div>

      <button
        disabled={!!busy}
        onClick={exportPesanan}
        className="w-full rounded-2xl bg-brand-600 py-4 font-bold text-white shadow-lg disabled:opacity-50"
      >
        {busy === "pesanan" ? "Menyiapkan…" : "📋 Ekspor Pesanan (detail)"}
      </button>
      <p className="px-1 text-xs text-stone-400">
        Satu baris per produk per pesanan — lengkap dengan nama, WhatsApp, status, dan catatan.
      </p>

      <button
        disabled={!!busy}
        onClick={exportRekap}
        className="w-full rounded-2xl bg-stone-800 py-4 font-bold text-white shadow-lg disabled:opacity-50"
      >
        {busy === "rekap" ? "Menyiapkan…" : "🍳 Rekap per Produk"}
      </button>
      <p className="px-1 text-xs text-stone-400">
        Total qty tiap produk — buat tahu harus bikin berapa banyak. Pesanan batal tidak dihitung.
      </p>

      {pesan && <p className="pt-1 text-center text-sm text-stone-600">{pesan}</p>}
      <p className="pt-2 text-center text-xs text-stone-400">
        File CSV, bisa langsung dibuka di Excel atau Google Sheets.
      </p>
    </div>
  );
}
