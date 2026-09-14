"use client";

import { useEffect, useState } from "react";
import { supabase, rupiah } from "../../lib/supabase";

const STATUSES = ["baru", "menunggu_konfirmasi", "lunas", "diproses", "selesai", "batal"];
const STATUS_LABEL = {
  baru: "🆕 Baru",
  menunggu_konfirmasi: "🕐 Cek Bukti",
  lunas: "💰 Lunas",
  diproses: "👩‍🍳 Diproses",
  selesai: "✅ Selesai",
  batal: "❌ Batal",
};

export default function Orders({ batches }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");

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

  const setStatus = async (id, status) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  // Bucket 'bukti' privat, jadi bikin link sementara (5 menit) pas diklik.
  const openProof = async (path) => {
    if (!path) return;
    if (path.startsWith("http")) return window.open(path, "_blank", "noreferrer");
    const { data, error } = await supabase.storage.from("bukti").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return alert("Gagal membuka bukti: " + (error?.message || "?"));
    window.open(data.signedUrl, "_blank", "noreferrer");
  };

  const batchName = (id) => batches.find((b) => b.id === id)?.name || "—";
  const totalMasuk = orders
    .filter((o) => o.status !== "batal")
    .reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
        >
          <option value="semua">Semua batch</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.status === "buka" ? "(buka)" : ""}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="p-6 text-center text-sm text-stone-500">Memuat…</p>
      ) : orders.length === 0 ? (
        <p className="p-6 text-center text-sm text-stone-500">Belum ada pesanan.</p>
      ) : (
        <>
          <div className="mb-3 flex justify-between rounded-2xl bg-brand-100 px-4 py-3">
            <span className="text-sm font-semibold">
              {orders.length} pesanan
              <span className="text-stone-500"> (tanpa yang batal)</span>
            </span>
            <span className="font-extrabold text-brand-700">{rupiah(totalMasuk)}</span>
          </div>

          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold">{o.customer_name}</p>
                    <a
                      href={`https://wa.me/${(o.phone || "").replace(/\D/g, "").replace(/^0/, "62")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-brand-600 underline"
                    >
                      {o.phone}
                    </a>
                    <p className="text-xs text-stone-400">
                      {new Date(o.created_at).toLocaleString("id-ID")} • {batchName(o.batch_id)}
                    </p>
                    {o.paid_at && (
                      <p className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                        {o.paid_via === "midtrans" ? "💳 Lunas otomatis (QRIS)" : "💰 Sudah dibayar"}
                      </p>
                    )}
                  </div>
                  <span className="font-extrabold text-brand-700">{rupiah(o.total)}</span>
                </div>

                <div className="mt-2 border-t border-stone-100 pt-2 text-sm">
                  {(o.order_items || []).map((it) => (
                    <p key={it.id}>
                      • {it.product_name} × {it.qty}
                    </p>
                  ))}
                  {o.notes && <p className="mt-1 text-xs italic text-stone-500">“{o.notes}”</p>}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={o.status}
                    onChange={(e) => setStatus(o.id, e.target.value)}
                    className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {o.payment_proof_url && (
                    <button
                      onClick={() => openProof(o.payment_proof_url)}
                      className="rounded-xl bg-brand-100 px-3 py-2 text-sm font-semibold text-brand-700"
                    >
                      Lihat Bukti
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
