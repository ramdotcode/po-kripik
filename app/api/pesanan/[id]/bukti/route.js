import { NextResponse } from "next/server";
import { supabaseAdmin, serviceKeyReady } from "../../../../../lib/supabase-server";
import { userDariRequest } from "../../../../../lib/auth-server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

const bad = (msg, code = 400) => NextResponse.json({ error: msg }, { status: code });

// Upload bukti transfer. Filenya masuk ke bucket privat 'bukti',
// yang tersimpan di orders.payment_proof_url adalah PATH-nya (bukan URL publik).
export async function POST(req, { params }) {
  if (!serviceKeyReady) return bad("Server belum dikonfigurasi.", 500);

  const id = params?.id;
  if (!UUID.test(String(id || ""))) return bad("Pesanan tidak ditemukan.", 404);

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status, paid_at, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!order) return bad("Pesanan tidak ditemukan.", 404);
  if (order.status === "batal") return bad("Pesanan ini sudah dibatalkan.", 409);
  if (order.paid_at || ["lunas", "diproses", "selesai"].includes(order.status))
    return bad("Pesanan ini sudah dibayar.", 409);

  // Pesanan milik akun: cuma pemiliknya yang boleh kirim bukti
  if (order.user_id) {
    const user = await userDariRequest(req);
    if (!user || user.id !== order.user_id)
      return bad("Masuk dulu pakai akun yang dipakai waktu memesan.", 401);
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return bad("Gagal membaca file.");
  }

  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return bad("File tidak ada.");
  if (file.size > MAX_BYTES) return bad("Ukuran file maksimal 5 MB.");

  const ext = EXT[file.type];
  if (!ext) return bad("Format harus JPG, PNG, WEBP, atau HEIC.");

  const path = `${id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabaseAdmin.storage
    .from("bukti")
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (upErr) return bad("Gagal upload: " + upErr.message, 500);

  const { error: updErr } = await supabaseAdmin
    .from("orders")
    .update({ payment_proof_url: path, status: "menunggu_konfirmasi", proof_note: null })
    .eq("id", id);
  if (updErr) return bad("Gagal menyimpan bukti: " + updErr.message, 500);

  return NextResponse.json({ ok: true, status: "menunggu_konfirmasi" });
}
