import { NextResponse } from "next/server";
import { supabaseAdmin, serviceKeyReady } from "../../../../../../lib/supabase-server";
import { midtransReady } from "../../../../../../lib/midtrans";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// Unduh gambar QR sebagai file. Pembeli yang buka web di HP nggak bisa
// nge-scan layarnya sendiri — mereka simpan QR ke galeri lalu upload dari
// aplikasi e-wallet/m-banking. <a download> tidak jalan lintas domain,
// jadi gambarnya dilewatkan server kita (sama seperti action download_qr elevra).
export async function GET(_req, { params }) {
  if (!serviceKeyReady || !midtransReady) return bad("Pembayaran QRIS otomatis belum aktif.", 503);
  if (!UUID.test(String(params?.id || ""))) return bad("Pesanan tidak ditemukan.", 404);

  // URL diambil dari database, BUKAN dari query string -> tidak bisa dipakai
  // buat nyuruh server kita fetch alamat sembarangan.
  const { data: intent } = await supabaseAdmin
    .from("payment_intents")
    .select("order_ref, qr_url, status")
    .eq("order_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!intent?.qr_url || intent.status !== "pending") return bad("QR tidak tersedia.", 404);

  let host = "";
  try {
    host = new URL(intent.qr_url).hostname;
  } catch {}
  if (!host.endsWith("midtrans.com")) return bad("Sumber QR tidak dikenal.", 400);

  const res = await fetch(intent.qr_url, { cache: "no-store" });
  if (!res.ok) return bad("Gagal mengambil gambar QR.", 502);

  return new NextResponse(await res.arrayBuffer(), {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/png",
      "Content-Disposition": `attachment; filename="QRIS-${intent.order_ref}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
