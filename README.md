# 🧺 PO Kripik

Web pemesanan pre-order kripik. Mobile-first, Next.js + Supabase.
Pesanan dikelompokkan per **batch PO** yang bisa dibuka/ditutup dari halaman admin.
Pembayaran pakai **QRIS dinamis Midtrans** yang lunas otomatis, atau QRIS statis + upload
bukti kalau Midtrans belum diaktifkan.

## Setup (sekali saja)

### 1. Bikin user admin

Supabase Dashboard → **Authentication → Users → Add user**. Isi email + password,
centang *Auto Confirm User*. Ini yang nanti dipakai login di `/admin`.

Pendaftaran publik **biarkan AKTIF** — pembeli daftar otomatis lewat Google. Akun pembeli
nggak bisa masuk admin, karena admin dicek dari tabel `admins`.

### 2. Jalankan SQL — urut (1–3 & 5 wajib)

Buka **SQL Editor**, jalankan satu per satu:

1. `supabase/schema.sql` — tabel dasar (produk, pesanan, item) + seed 12 produk.
2. `supabase/migration-batch-auth.sql` — batch PO, login admin, RLS ketat.
   **Sebelum Run, ganti `GANTI_DENGAN_EMAIL_ADMIN_KAMU`** dengan email admin dari langkah 1.
   Di akhir ada `select * from admins;` — harus keluar 1 baris.
3. `supabase/migration-midtrans.sql` — tabel `payment_intents` + kolom `paid_at`.
4. `supabase/migration-menu-poster.sql` — berat, badge FAVORIT/BARU, dan urutan menu sesuai poster.
   Opsional: tanpa ini web tetap jalan, cuma berat/badge belum tampil dan menu urut abjad.
5. `supabase/migration-login-bayar-manual.sql` — **wajib**: pesanan nempel ke akun pembeli,
   alasan tolak bukti, tabel `settings` (gambar QRIS), bucket publik `toko`.

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
| `QRIS_OTOMATIS` | **kosongkan** — QRIS dinamis disembunyikan. Isi `true` kalau Midtrans production sudah aktif | — |

`SUPABASE_SERVICE_ROLE_KEY` dan `MIDTRANS_SERVER_KEY` **rahasia** — jangan di-commit,
jangan ditempel di chat atau screenshot. Keduanya sengaja tanpa prefix `NEXT_PUBLIC_`
supaya cuma hidup di server.

Selama `MIDTRANS_SERVER_KEY` masih placeholder, web otomatis pakai QRIS statis +
upload bukti (langkah 4 wajib). Begitu diisi, halaman bayar pindah ke QRIS dinamis.

### 4. QRIS statis & harga

- Upload gambar QRIS statis tokomu dari `/admin` tab **QRIS** (tersimpan di Supabase Storage).
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

## Login pembeli & bayar manual (alur sekarang)

1. Pembeli pilih camilan → di keranjang **Masuk dengan Google** (isi keranjang nggak hilang).
2. Isi nama & WA → **Buat Pesanan**. Pesanan tersimpan di akunnya dengan status **Belum bayar**.
3. Bayar sekarang atau nanti: scan QRIS statis dari admin, lalu **Upload bukti**.
   Semua pesanan bisa dibuka lagi dari **Pesanan Saya** (`/pesanan`).
4. Status jadi **Bukti dicek**. Admin buka tab **Pesanan**:
   - **ACC** → *Sudah bayar* (`paid_at` tercatat).
   - **Tolak** + alasan → balik ke *Belum bayar*, alasannya tampil ke pembeli, pembeli upload ulang.

### Setup login Google (sekali saja)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **OAuth consent screen**
   (External, nama app "PO Kripik", email support) → **Credentials → Create credentials → OAuth client ID**
   (Web application).
   - Authorized JavaScript origins: `https://kripik.ramcode.site` dan `http://localhost:3001`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Supabase → **Authentication → Sign In / Providers → Google** → aktifkan, tempel Client ID & Secret.
3. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://kripik.ramcode.site`
   - Redirect URLs: `https://kripik.ramcode.site/**` dan `http://localhost:3001/**`
4. Google Auth Platform → **Branding**: App name `PO Kripik`, user support email, homepage
   `https://kripik.ramcode.site`, privacy policy `https://kripik.ramcode.site/privasi`, authorized domains
   `ramcode.site` + `<project-ref>.supabase.co`. **Jangan upload logo** (memicu verifikasi brand).
   Lalu **Audience → Publish app** (In production). Scope cuma email/profile/openid → nggak perlu verifikasi.

## Pembayaran Midtrans (QRIS otomatis — sekarang disembunyikan)

Kodenya tetap ada, tapi mati selama `QRIS_OTOMATIS` bukan `true`. Nyalakan setelah akun
Midtrans production aktif; sampai saat itu pembeli bayar manual seperti di atas.

Pakai **Snap** (halaman bayar Midtrans), khusus QRIS. Core API nggak dipakai karena belum
diaktifkan Midtrans di akun ini (semua charge ditolak "Payment channel is not activated").
Webhook, signature, dan cek status Snap sama persis dengan Core API.

Alurnya:

1. Pembeli bikin pesanan → halaman `/bayar/[id]` minta sesi bayar ke server.
2. Server bikin transaksi Snap (QRIS, berlaku 30 menit), simpan di `payment_intents`.
   Reload halaman pakai sesi yang sama, nggak bikin transaksi baru.
3. Pembeli tap **Bayar dengan QRIS** → halaman Midtrans menampilkan QR + tombol
   *Download QRIS* (buat yang bayar dari HP yang sama).
4. Setelah bayar, Midtrans mengembalikan pembeli ke `/bayar/[id]` dan kirim webhook →
   server cek ulang status ke API Midtrans → pesanan jadi **lunas** otomatis.
5. Cadangan: halaman bayar nanya status tiap 4 detik (langsung saat balik dari Midtrans),
   server meneruskannya ke Midtrans maks sekali per 8 detik. Jadi tetap lunas walau
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
2. Bikin pesanan sampai halaman bayar, tap **Bayar dengan QRIS**.
3. Di halaman Midtrans, klik kanan gambar QR → *Copy image address*.
4. Buka [simulator QRIS Midtrans](https://simulator.sandbox.midtrans.com/v2/qris/index),
   paste URL-nya → **Scan QR** → **Pay**.
5. Balik ke halaman bayar: dalam ±10 detik berubah jadi "Pembayaran berhasil" dan di admin
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
- `/keranjang` — masuk Google dulu, lalu isi nama + WhatsApp, buat pesanan (masuk ke batch yang lagi buka)
- `/bayar/[id]` — QRIS statis dari admin + upload bukti (bisa bayar nanti). Pesanan milik akun cuma bisa dibuka pemiliknya
- `/pesanan` — Pesanan Saya: semua pesanan si pembeli & status bayarnya
- `/privasi` — Kebijakan Privasi (syarat publish login Google), ditautkan di footer & kartu login
- `/admin` — login dulu, lalu 5 tab:
  - **Pesanan** — filter per batch, cari, ubah status, chat WA, lihat bukti, **ACC / Tolak** bukti
  - **Batch** — bikin batch baru, buka/tutup PO, edit nama & catatan
  - **Produk** — ubah harga, aktif/nonaktifkan produk
  - **QRIS** — upload / ganti gambar QRIS statis yang di-scan pembeli
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
