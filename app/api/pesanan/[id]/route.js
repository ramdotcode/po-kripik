import { NextResponse } from "next/server";
import { supabaseAdmin, serviceKeyReady } from "../../../../lib/supabase-server";
import { midtransReady } from "../../../../lib/midtrans";
import { userDariRequest } from "../../../../lib/auth-server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Status yang berarti uang sudah masuk, termasuk yang ditandai admin manual
const SUDAH_BAYAR = ["lunas", "diproses", "selesai"];

const json = (body, status = 200) => NextResponse.json(body, { status });
const TIDAK_ADA = { error: "Pesanan tidak ditemukan." };

// Detail satu pesanan buat halaman /bayar/[id].
// - Pesanan milik akun (user_id terisi): cuma pemiliknya yang sedang login.
// - Pesanan lama tanpa akun: tetap bisa dibuka lewat link (ID UUID acak = kuncinya).
// Nomor WA sengaja TIDAK ikut dikirim balik.
export async function GET(req, { params }) {
  if (!serviceKeyReady) return json({ error: "Server belum dikonfigurasi." }, 500);

  const id = params?.id;
  if (!UUID.test(String(id || ""))) return json(TIDAK_ADA, 404);

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      "id, user_id, customer_name, total, status, notes, payment_proof_url, proof_note, paid_at, created_at, batches(name, note)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) return json(TIDAK_ADA, 404);

  if (order.user_id) {
    const user = await userDariRequest(req);
    if (!user) return json({ error: "Masuk dulu buat lihat pesanan ini.", perlu_login: true }, 401);
    // Akun lain: jawab "tidak ditemukan" biar keberadaan pesanan orang nggak bocor
    if (user.id !== order.user_id) return json(TIDAK_ADA, 404);
  }

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("id, product_name, price, qty")
    .eq("order_id", id);

  return json({
    order: {
      id: order.id,
      customer_name: order.customer_name,
      total: order.total,
      status: order.status,
      notes: order.notes,
      created_at: order.created_at,
      sudah_upload: Boolean(order.payment_proof_url),
      sudah_bayar: Boolean(order.paid_at) || SUDAH_BAYAR.includes(order.status),
      bukti_ditolak: order.status === "baru" ? order.proof_note || null : null,
      milik_akun: Boolean(order.user_id),
      // true = QRIS dinamis Midtrans; false = QRIS statis dari admin + upload bukti
      bayar_otomatis: midtransReady,
      batch_name: order.batches?.name || null,
      batch_note: order.batches?.note || null,
    },
    items: items || [],
  });
}
