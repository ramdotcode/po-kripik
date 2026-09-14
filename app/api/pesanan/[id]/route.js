import { NextResponse } from "next/server";
import { supabaseAdmin, serviceKeyReady } from "../../../../lib/supabase-server";
import { midtransReady } from "../../../../lib/midtrans";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Status yang berarti uang sudah masuk, termasuk yang ditandai admin manual
const SUDAH_BAYAR = ["lunas", "diproses", "selesai"];

// Detail satu pesanan buat halaman /bayar/[id].
// ID-nya UUID acak, jadi link-nya sendiri yang berfungsi sebagai kunci.
// Nomor WA sengaja TIDAK ikut dikirim balik.
export async function GET(_req, { params }) {
  if (!serviceKeyReady)
    return NextResponse.json({ error: "Server belum dikonfigurasi." }, { status: 500 });

  const id = params?.id;
  if (!UUID.test(String(id || "")))
    return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, customer_name, total, status, notes, payment_proof_url, paid_at, created_at, batches(name, note)")
    .eq("id", id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("id, product_name, price, qty")
    .eq("order_id", id);

  return NextResponse.json({
    order: {
      id: order.id,
      customer_name: order.customer_name,
      total: order.total,
      status: order.status,
      notes: order.notes,
      created_at: order.created_at,
      sudah_upload: Boolean(order.payment_proof_url),
      sudah_bayar: Boolean(order.paid_at) || SUDAH_BAYAR.includes(order.status),
      // true = QRIS dinamis Midtrans; false = QRIS statis + upload bukti
      bayar_otomatis: midtransReady,
      batch_name: order.batches?.name || null,
      batch_note: order.batches?.note || null,
    },
    items: items || [],
  });
}
