import { NextResponse } from "next/server";
import { supabaseAdmin, serviceKeyReady } from "../../../../../lib/supabase-server";
import {
  midtransReady,
  buildOrderRef,
  createSnap,
  getStatus,
  applyStatus,
  QR_EXPIRY_MINUTES,
} from "../../../../../lib/midtrans";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_CHECK_EVERY_MS = 8000;
const SUDAH_BAYAR = ["lunas", "diproses", "selesai"];

const json = (body, status = 200) => NextResponse.json(body, { status });
const bad = (msg, status = 400) => json({ error: msg }, status);

function guard(id) {
  if (!serviceKeyReady || !midtransReady) return bad("Pembayaran QRIS otomatis belum aktif.", 503);
  if (!UUID.test(String(id || ""))) return bad("Pesanan tidak ditemukan.", 404);
  return null;
}

async function loadOrder(id) {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, customer_name, phone, total, status, paid_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function latestIntent(orderId) {
  const { data } = await supabaseAdmin
    .from("payment_intents")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// Link halaman bayar Snap disimpan di payload (kolom qr_url peninggalan Core API dibiarkan kosong)
const view = (intent, status) => ({
  paid: false,
  status: status || intent.status,
  pay_url: intent.payload?.redirect_url || null,
  expiry_time: intent.expiry_time,
  amount: intent.amount,
  ref: intent.order_ref,
});

// Bikin sesi bayar Snap baru, atau kembalikan yang masih aktif —
// reload halaman bayar tidak boleh bikin transaksi baru terus-terusan.
export async function POST(req, { params }) {
  const g = guard(params?.id);
  if (g) return g;

  const order = await loadOrder(params.id);
  if (!order) return bad("Pesanan tidak ditemukan.", 404);
  if (order.paid_at || SUDAH_BAYAR.includes(order.status)) return json({ paid: true });
  if (order.status === "batal") return bad("Pesanan ini sudah dibatalkan.", 409);
  if (!(order.total > 0)) return bad("Total pesanan tidak valid.");

  const current = await latestIntent(order.id);
  const sisaMs = current ? new Date(current.expiry_time).getTime() - Date.now() : 0;
  if (current && current.status === "pending" && current.payload?.redirect_url && sisaMs > 60_000) {
    return json(view(current));
  }

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_id, product_name, price, qty")
    .eq("order_id", order.id);
  const itemDetails = (items || []).map((it, i) => ({
    id: String(it.product_id || `item-${i + 1}`).slice(0, 50),
    name: String(it.product_name).slice(0, 50),
    price: it.price,
    quantity: it.qty,
  }));
  // Midtrans menolak kalau jumlah item_details != gross_amount. Total pesanan
  // dihitung server dari item yang sama jadi harusnya selalu cocok — kalau
  // tidak (mis. data lama diedit manual), kirim tanpa rincian daripada gagal.
  const sum = itemDetails.reduce((s, it) => s + it.price * it.quantity, 0);

  const orderRef = buildOrderRef(order.id);
  let snap;
  try {
    snap = await createSnap({
      orderRef,
      amount: order.total,
      items: sum === order.total ? itemDetails : undefined,
      customer: { first_name: String(order.customer_name).slice(0, 50), phone: order.phone },
      // Setelah bayar, Midtrans mengembalikan pembeli ke halaman bayar kita
      finishUrl: `${new URL(req.url).origin}/bayar/${order.id}`,
    });
  } catch (e) {
    console.error("[midtrans] snap gagal:", e.message);
    return bad("Gagal menyiapkan pembayaran: " + e.message, 502);
  }

  const intent = {
    order_ref: orderRef,
    order_id: order.id,
    amount: order.total,
    status: "pending",
    qr_url: null,
    expiry_time: new Date(Date.now() + QR_EXPIRY_MINUTES * 60_000).toISOString(),
    payload: { token: snap.token, redirect_url: snap.redirect_url },
  };
  const { error } = await supabaseAdmin.from("payment_intents").insert(intent);
  if (error) return bad("Gagal menyimpan sesi pembayaran: " + error.message, 500);

  return json(view(intent));
}

// Dipolling halaman bayar. Selain baca DB, sesekali tanya status langsung ke
// Midtrans — jadi tetap jalan walau webhook telat, gagal, atau memang belum
// bisa diterima (mis. lagi develop di localhost).
export async function GET(_req, { params }) {
  const g = guard(params?.id);
  if (g) return g;

  const order = await loadOrder(params.id);
  if (!order) return bad("Pesanan tidak ditemukan.", 404);
  if (order.paid_at || SUDAH_BAYAR.includes(order.status)) return json({ paid: true });

  const intent = await latestIntent(order.id);
  if (!intent) return json({ paid: false, status: null });

  const stale =
    !intent.checked_at || Date.now() - new Date(intent.checked_at).getTime() > STATUS_CHECK_EVERY_MS;
  if (intent.status === "pending" && stale) {
    try {
      const st = await getStatus(intent.order_ref);
      const r = await applyStatus(supabaseAdmin, intent, st);
      if (r.paid) return json({ paid: true });
      return json(view(intent, r.status));
    } catch (e) {
      console.error("[midtrans] cek status gagal:", e.message);
    }
  }
  return json(view(intent));
}
