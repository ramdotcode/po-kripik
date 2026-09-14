import { NextResponse } from "next/server";
import { supabaseAdmin, serviceKeyReady } from "../../../../lib/supabase-server";
import { midtransReady, verifySignature, getStatus, applyStatus } from "../../../../lib/midtrans";

export const dynamic = "force-dynamic";

const json = (body, status = 200) => NextResponse.json(body, { status });

// Webhook HTTP Notification Midtrans.
// Kode balasan menentukan retry Midtrans: 2xx selesai, 503 diulang 4x
// (2, 10, 30, 90 menit), 500 cuma 1x — jadi gangguan sementara dibalas 503.
export async function POST(req) {
  if (!midtransReady || !serviceKeyReady) return json({ error: "belum dikonfigurasi" }, 503);

  let n;
  try {
    n = await req.json();
  } catch {
    return json({ error: "body bukan JSON" }, 400);
  }

  if (!verifySignature(n)) {
    console.warn("[midtrans] signature tidak valid untuk", n?.order_id);
    return json({ error: "signature tidak valid" }, 400);
  }

  const { data: intent, error } = await supabaseAdmin
    .from("payment_intents")
    .select("*")
    .eq("order_ref", String(n.order_id))
    .maybeSingle();
  if (error) return json({ error: error.message }, 503);

  // Bukan transaksi web kripik (mis. akun Midtrans dipakai bareng project lain).
  // Balas 200 supaya Midtrans tidak mengulang-ulang.
  if (!intent) return json({ ok: true, ignored: true });

  try {
    // Isi notifikasi tidak dipakai langsung: status diambil ulang dari API
    // Midtrans (anjuran resmi) supaya pasti asli dan yang paling baru.
    const st = await getStatus(intent.order_ref);
    const r = await applyStatus(supabaseAdmin, intent, st);
    return json({ ok: true, paid: r.paid });
  } catch (e) {
    console.error("[midtrans] gagal memproses notifikasi", intent.order_ref, e.message);
    return json({ error: e.message }, 503);
  }
}
