import crypto from "crypto";

// Integrasi Midtrans Core API (QRIS dinamis). Server-only: dipakai route handler
// di app/api, JANGAN diimport dari komponen "use client".
// Pola mengikuti elevra-grad-main (supabase/functions/midtrans-payment & -callback).

const serverKey = (process.env.MIDTRANS_SERVER_KEY || "").trim();
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
const notificationUrl = (process.env.MIDTRANS_NOTIFICATION_URL || "").trim();

const API_BASE = isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";

// Kosong / masih placeholder = QRIS otomatis mati, web balik ke QRIS statis + upload bukti.
export const midtransReady = Boolean(serverKey) && !/^ISI_|^isi-/.test(serverKey);

export const QR_EXPIRY_MINUTES = 30;

const authHeader = () => "Basic " + Buffer.from(`${serverKey}:`).toString("base64");

// order_id Midtrans maks 50 karakter & harus unik per charge. QR yang kedaluwarsa
// butuh charge baru, jadi pakai ref sendiri, bukan UUID pesanan mentah.
// Ref ini primary key payment_intents -> webhook lookup langsung tanpa mem-parse
// string (catatan IMPROVEMENTS.md elevra #9).
export const buildOrderRef = (orderId) =>
  `KRP-${String(orderId).slice(0, 8)}-${Date.now().toString(36)}`;

export const qrUrlFrom = (charge) =>
  (charge?.actions || []).find((a) => a.name === "generate-qr-code")?.url || null;

// Midtrans kirim expiry_time sebagai "YYYY-MM-DD HH:mm:ss" waktu Jakarta tanpa zona.
export function parseExpiry(s) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(String(s || ""));
  if (m) return new Date(`${m[1]}T${m[2]}+07:00`).toISOString();
  return new Date(Date.now() + QR_EXPIRY_MINUTES * 60_000).toISOString();
}

export async function chargeQris({ orderRef, amount, items, customer }) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: authHeader(),
  };
  // Satu akun Midtrans cuma punya satu Notification URL di dashboard. Header ini
  // mengarahkan notifikasi transaksi INI ke web kripik — perlu kalau akunnya
  // dipakai bareng project lain.
  if (notificationUrl) headers["X-Override-Notification"] = notificationUrl;

  const res = await fetch(`${API_BASE}/v2/charge`, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: { order_id: orderRef, gross_amount: amount },
      ...(items ? { item_details: items } : {}),
      customer_details: customer,
      custom_expiry: { expiry_duration: QR_EXPIRY_MINUTES, unit: "minute" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  // Midtrans kadang balas HTTP 200 tapi status_code di body 4xx/5xx
  const code = String(data.status_code || res.status);
  if (!res.ok || !code.startsWith("2")) {
    const msg = Array.isArray(data.error_messages)
      ? data.error_messages.join(", ")
      : data.status_message;
    throw new Error(msg || `Midtrans menolak (HTTP ${res.status})`);
  }
  return data;
}

export async function getStatus(orderRef) {
  const res = await fetch(`${API_BASE}/v2/${encodeURIComponent(orderRef)}/status`, {
    headers: { Accept: "application/json", Authorization: authHeader() },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.status_message || `Midtrans HTTP ${res.status}`);
  return data;
}

// SHA512(order_id + status_code + gross_amount + ServerKey), dibandingkan timing-safe.
export function verifySignature({ order_id, status_code, gross_amount, signature_key } = {}) {
  if (!order_id || !status_code || !gross_amount || !signature_key) return false;
  const expected = crypto
    .createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature_key));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const isPaid = (ts, fraud) =>
  (ts === "settlement" || ts === "capture") && (!fraud || fraud === "accept");

// Terapkan status Midtrans ke database. Dipanggil webhook DAN polling halaman
// bayar, jadi harus idempoten: panggilan dobel tidak boleh menulis ulang.
export async function applyStatus(db, intent, st) {
  const ts = String(st?.transaction_status || "");
  const now = new Date().toISOString();

  if (isPaid(ts, st.fraud_status)) {
    // Nominal yang dibayar harus sama dengan yang ditagih
    if (Math.round(Number(st.gross_amount)) !== Number(intent.amount)) {
      console.error(
        `[midtrans] nominal beda ${intent.order_ref}: bayar ${st.gross_amount}, tagihan ${intent.amount}`
      );
      await db
        .from("payment_intents")
        .update({ status: "nominal_beda", notif: st, checked_at: now })
        .eq("order_ref", intent.order_ref);
      return { paid: false, status: "nominal_beda" };
    }
  }

  const paid = isPaid(ts, st.fraud_status);
  const { error: e1 } = await db
    .from("payment_intents")
    .update({
      status: ts || intent.status,
      notif: st,
      checked_at: now,
      ...(paid && !intent.paid_at ? { paid_at: now } : {}),
    })
    .eq("order_ref", intent.order_ref);
  if (e1) throw new Error(e1.message);

  if (!paid) return { paid: false, status: ts || intent.status };

  // `paid_at is null` = idempoten: notifikasi dobel / poll + webhook bareng aman.
  const { error: e2 } = await db
    .from("orders")
    .update({ paid_at: now, paid_via: "midtrans" })
    .eq("id", intent.order_id)
    .is("paid_at", null);
  if (e2) throw new Error(e2.message);

  // Status cuma dimajukan dari tahap awal. Pesanan yang sudah diproses/selesai,
  // atau yang dibatalkan admin, tidak disentuh (paid_at tetap tercatat di atas).
  const { error: e3 } = await db
    .from("orders")
    .update({ status: "lunas" })
    .eq("id", intent.order_id)
    .in("status", ["baru", "menunggu_konfirmasi"]);
  if (e3) throw new Error(e3.message);

  return { paid: true, status: ts };
}
