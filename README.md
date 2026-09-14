# 🧺 PO Kripik

Web pemesanan pre-order kripik. Mobile-first, Next.js + Supabase.
Pesanan dikelompokkan per **batch PO** yang bisa dibuka/ditutup dari halaman admin.
Pembayaran pakai **QRIS dinamis Midtrans** yang lunas otomatis, atau QRIS statis + upload
bukti kalau Midtrans belum diaktifkan.

## Setup (sekali saja)

### 1. Bikin user admin

Supabase Dashboard → **Authentication → Users → Add user**. Isi email + password,
centang *Auto Confirm User*. Ini yang nanti dipakai login di `/admin`.

Sekalian matikan pendaftaran publik: **Authentication → Providers → Email**,
matikan *Enable signup*. Biar nggak ada orang lain yang bisa bikin akun sendiri.

### 2. Jalankan SQL — urut (1–3 wajib)

Buka **SQL Editor**, jalankan satu per satu:

1. `supabase/schema.sql` — tabel dasar (produk, pesanan, item) + seed 12 produk.
2. `supabase/migration-batch-auth.sql` — batch PO, login admin, RLS ketat.
   **Sebelum Run, ganti `GANTI_DENGAN_EMAIL_ADMIN_KAMU`** dengan email admin dari langkah 1.
   Di akhir ada `select * from admins;` — harus keluar 1 baris.
3. `supabase/migration-midtrans.sql` — tabel `payment_intents` + kolom `paid_at`.
4. `supabase/migration-menu-poster.sql` — berat, badge FAVORIT/BARU, dan urutan menu sesuai poster.
   Opsional: tanpa ini web tetap jalan, cuma berat/badge belum tampil dan menu urut abjad.

Jangan dilompati: kode sudah membaca kolom dari ketiga file ini. Kalau yang ke-3 belum
jalan, halaman bayar bakal bilang "Pesanan tidak ditemukan".

### 3. Isi environment variable

`.env.local`:

| Variable | Isi | Dari mana |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key | sama |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (klik *Reveal*) | sama |
| `MIDTRANS_SERVER_KEY` | Server Key | Midtrans → Settings → Access Keys |
| `MIDTRANS_IS_PRODUCTION` | `false` buat sandbox, `true` buat uang beneran | — |
| `MIDTRANS_NOTIFICATION_URL` | `https://domain-kamu/api/midtrans/notifikasi` | isi setelah deploy |

`SUPABASE_SERVICE_ROLE_KEY` dan `MIDTRANS_SERVER_KEY` **rahasia** — jangan di-commit,
jangan ditempel di chat atau screenshot. Keduanya sengaja tanpa prefix `NEXT_PUBLIC_`
supaya cuma hidup di server.

Selama `MIDTRANS_SERVER_KEY` masih placeholder, web otomatis pakai QRIS statis +
upload bukti (langkah 4 wajib). Begitu diisi, halaman bayar pindah ke QRIS dinamis.

### 4. QRIS statis & harga

- Ganti `public/qris.png` dengan QRIS asli (cuma dipakai kalau Midtrans belum aktif).
- Menu & harga sudah mengikuti poster 13 Sep 2026. Perubahan harga berikutnya lewat `/admin` tab **Produk**.
- Nomor WA toko ada di `lib/toko.js`.

## Menjalankan

```bash
npm install
```

```bash
npm run dev
```

Buka http://localhost:3000 (di HP: pakai IP laptop, misal http://192.168.1.x:3000).

## Pembayaran Midtrans

Alurnya:

1. Pembeli bikin pesanan → halaman `/bayar/[id]` minta QR ke server.
2. Server charge QRIS ke Midtrans (berlaku 30 menit), simpan di `payment_intents`.
   Reload halaman pakai QR yang sama, nggak bikin charge baru.
3. Pembeli scan. Kalau bayarnya dari HP yang sama, ada tombol **Simpan QR ke Galeri**.
4. Midtrans kirim webhook → server cek ulang status ke API Midtrans → pesanan jadi
   **lunas** otomatis dan halaman bayar langsung berubah.
5. Cadangan: halaman bayar juga nanya status tiap beberapa detik, dan server
   meneruskannya ke Midtrans (maks sekali per 8 detik). Jadi tetap lunas walau
   webhook telat, gagal, atau belum bisa diterima (mis. lagi di localhost).

Pengaman:

- Signature webhook diverifikasi (SHA512, dibandingkan timing-safe), lalu status
  **diambil ulang dari API Midtrans** — isi notifikasi nggak dipercaya mentah-mentah.
- Nominal yang dibayar dicocokkan dengan tagihan. Kalau beda, pesanan **tidak**
  ditandai lunas dan intent-nya berstatus `nominal_beda`.
- Idempoten: notifikasi dobel atau webhook + polling bareng nggak nulis ulang.
- Status pesanan cuma dimajukan dari `baru`/`menunggu_konfirmasi`. Pesanan yang
  sudah diproses atau dibatalkan admin nggak disentuh (tapi `paid_at` tetap tercatat).

### Tes di sandbox

1. Isi `MIDTRANS_SERVER_KEY` dengan Server Key **sandbox** (dashboard mode Sandbox →
   Settings → Access Keys), `MIDTRANS_IS_PRODUCTION=false`, restart `npm run dev`.
   Akun baru: key sandbox diawali `Mid-server-` juga (tanpa `SB-`), jadi awalan nggak bisa
   dipakai buat membedakan sandbox/production — cek di dashboard mode mana key itu diambil.
2. Bikin pesanan sampai halaman bayar muncul QR.
3. Klik kanan gambar QR → *Copy image address*.
4. Buka [simulator QRIS Midtrans](https://simulator.sandbox.midtrans.com/v2/qris/index),
   paste URL-nya, bayar.
5. Dalam ±10 detik halaman bayar berubah jadi "Pembayaran berhasil" dan di admin
   muncul penanda 💳 Lunas otomatis.

**Jangan pernah bayar QR sandbox pakai e-wallet/bank beneran** — kata Midtrans, QR
sandbox bisa nyasar ke Merchant ID production kamu.

### Pindah ke production

1. Ganti ke Server Key production, `MIDTRANS_IS_PRODUCTION=true`.
2. Isi `MIDTRANS_NOTIFICATION_URL` dengan URL publik webhook.
   URL ini dikirim per transaksi (header `X-Override-Notification`), jadi aman walau
   akun Midtrans-nya dipakai bareng project lain.
3. Pastikan channel QRIS sudah aktif di akun production Midtrans.

## Halaman

- `/` — katalog. Kalau nggak ada batch yang buka, tombol pesan mati dan muncul "PO lagi tutup".
- `/keranjang` — isi nama + WhatsApp, buat pesanan (masuk ke batch yang lagi buka)
- `/bayar/[id]` — QRIS dinamis (lunas otomatis), atau QRIS statis + upload bukti
- `/admin` — login dulu, lalu 4 tab:
  - **Pesanan** — filter per batch, ubah status, chat WA, lihat bukti, penanda lunas otomatis
  - **Batch** — bikin batch baru, buka/tutup PO, edit nama & catatan
  - **Produk** — ubah harga, aktif/nonaktifkan produk
  - **Ekspor** — unduh CSV: detail pesanan (termasuk kolom Dibayar), atau rekap qty per produk

## Cara pakai per batch

1. `/admin` → tab **Batch** → **Bikin Batch** (mis. "Batch 3 — September", catatan "ambil 12 Sep").
2. Klik **Buka PO ini**. Batch lain yang lagi buka otomatis ditutup — cuma boleh satu yang buka.
3. Sebar link webnya. Pesanan yang masuk otomatis nempel ke batch itu.
4. Kalau sudah cukup, klik **Tutup PO ini**. Katalog langsung berubah jadi "PO lagi tutup".
5. Tab **Ekspor** → pilih batch → **Rekap per Produk** buat tahu harus bikin berapa banyak.

## Deploy (opsional)

Paling gampang pakai [Vercel](https://vercel.com): import repo → isi **semua** environment
variable seperti `.env.local` → deploy. Setelah dapat domain, isi
`MIDTRANS_NOTIFICATION_URL` lalu redeploy.

## Catatan keamanan

Yang sudah diamankan:

- Login admin lewat Supabase Auth. Password nggak pernah ikut ke browser.
- RLS ketat: pengunjung biasa cuma bisa baca katalog & status batch. Data pesanan
  (nama, no WA) dan bukti bayar cuma bisa dibaca akun yang terdaftar di tabel `admins`.
- `payment_intents` dikunci policy RESTRICTIVE — cuma server yang bisa nulis.
- Pesanan masuk lewat route API server-side. **Harga dihitung ulang dari database**,
  jadi orang nggak bisa ngirim harga palsu dari browser.
- Bucket `bukti` privat. Admin lihat lewat signed URL yang cuma hidup 5 menit.

Yang masih perlu disadari:

- Halaman `/bayar/[id]` bisa dibuka siapa pun yang punya link-nya (ID-nya UUID acak,
  jadi praktis nggak bisa ditebak). Nomor WA sengaja nggak ikut ditampilkan di situ.
- Belum ada rate limit di route pesanan — orang iseng masih bisa spam pesanan palsu.
