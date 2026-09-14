import { NextResponse } from "next/server";
import { supabaseAdmin, serviceKeyReady } from "../../../lib/supabase-server";
import { userDariRequest } from "../../../lib/auth-server";

export const dynamic = "force-dynamic";

const bad = (msg, code = 400) => NextResponse.json({ error: msg }, { status: code });

export async function POST(req) {
  if (!serviceKeyReady) return bad("Server belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY kosong).", 500);

  // Pembeli wajib login (Google) — pesanan disimpan di akunnya, bisa dibayar nanti
  const user = await userDariRequest(req);
  if (!user) return bad("Masuk dulu pakai akun Google ya.", 401);

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Format request tidak valid.");
  }

  const nama = String(body?.customer_name || "").trim();
  const phone = String(body?.phone || "").trim();
  const notes = String(body?.notes || "").trim();
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!nama) return bad("Nama wajib diisi.");
  if (!/^[0-9+\-\s()]{8,20}$/.test(phone)) return bad("Nomor WhatsApp tidak valid.");
  if (items.length === 0) return bad("Keranjang kosong.");
  if (items.length > 50) return bad("Terlalu banyak jenis produk.");

  // Batch yang lagi buka — pesanan cuma diterima kalau PO lagi dibuka.
  // Error query dibedakan dari "tidak ada batch buka" supaya salah konfigurasi
  // tidak menyamar jadi pesan "PO lagi tutup".
  const { data: batch, error: batchErr } = await supabaseAdmin
    .from("batches")
    .select("id, name, status")
    .eq("status", "buka")
    .maybeSingle();
  if (batchErr) return bad("Gagal membaca batch: " + batchErr.message, 500);
  if (!batch) return bad("PO lagi tutup, belum bisa pesan.", 409);

  // Harga diambil ulang dari database, TIDAK percaya harga kiriman browser
  const ids = [...new Set(items.map((i) => String(i.product_id)))];
  const { data: products, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, name, price, active")
    .in("id", ids);
  if (prodErr) return bad("Gagal membaca produk: " + prodErr.message, 500);

  const byId = new Map((products || []).map((p) => [p.id, p]));
  const rows = [];
  for (const item of items) {
    const p = byId.get(String(item.product_id));
    const qty = Math.floor(Number(item.qty));
    if (!p) return bad("Ada produk yang sudah tidak tersedia.");
    if (!p.active) return bad(`"${p.name}" lagi kosong.`);
    if (!Number.isFinite(qty) || qty < 1 || qty > 999) return bad("Jumlah pesanan tidak wajar.");
    rows.push({ product_id: p.id, product_name: p.name, price: p.price, qty });
  }

  const total = rows.reduce((s, r) => s + r.price * r.qty, 0);

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      customer_name: nama,
      phone,
      notes: notes || null,
      total,
      status: "baru",
      batch_id: batch.id,
      user_id: user.id,
      customer_email: user.email || null,
    })
    .select("id")
    .single();
  if (orderErr) return bad("Gagal membuat pesanan: " + orderErr.message, 500);

  const { error: itemErr } = await supabaseAdmin
    .from("order_items")
    .insert(rows.map((r) => ({ ...r, order_id: order.id })));
  if (itemErr) {
    // Jangan tinggalkan pesanan tanpa item
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    return bad("Gagal menyimpan item: " + itemErr.message, 500);
  }

  return NextResponse.json({ id: order.id, total, batch: batch.name });
}
