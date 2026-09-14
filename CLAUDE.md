# PO Kripik — Konteks Project

Web pemesanan pre-order kripik. Mobile-first (max-w-md, dioptimalkan untuk HP). Bahasa UI: Indonesia, tone santai.
Pesanan dikelompokkan per **batch PO** yang dibuka/ditutup dari halaman admin.

## Stack
- Next.js 14 App Router, JavaScript (bukan TypeScript), file .jsx
- Tailwind CSS 3 (warna brand oranye, lihat tailwind.config.js)
- Supabase (@supabase/supabase-js) — kredensial di `.env.local`
  - `lib/supabase.js` — client browser (anon key)
  - `lib/supabase-server.js` — client server (service role key, bypass RLS). JANGAN diimport dari komponen `"use client"`.
- Auth admin: Supabase Auth email+password, dicek ke tabel `admins`
- State keranjang: React Context + localStorage (`lib/cart.js`)
- Pembayaran: **QRIS dinamis Midtrans Core API** (`lib/midtrans.js`, server-only) kalau `MIDTRANS_SERVER_KEY` diisi.
  Kalau kosong/placeholder → fallback QRIS statis (`public/qris.png`) + upload bukti ke bucket `bukti` (privat)
- Pola Midtrans mengikuti project `../elevra-grad-main` (supabase/functions/midtrans-payment & midtrans-callback)
- Tanpa ongkir — total = harga × qty saja. Fee MDR TIDAK dibebankan ke pembeli

## Halaman
- `/` — katalog (`products` aktif) + banner batch. Kalau tidak ada batch `status='buka'`: tombol pesan mati, gambar grayscale, keranjang otomatis dikosongkan
- `/keranjang` — edit qty, form nama + no WA + catatan → POST `/api/pesanan` → redirect ke `/bayar/[id]`
- `/bayar/[id]` — GET `/api/pesanan/[id]` (field `bayar_otomatis` menentukan mode):
  - otomatis: POST `/api/pesanan/[id]/qris` → tampil QR + countdown + tombol simpan ke galeri, polling GET `/qris` tiap 4 detik
  - manual: gambar QRIS statis + upload bukti → POST `/api/pesanan/[id]/bukti`
- `/admin` — login Supabase Auth. 4 tab: Pesanan (filter batch, ubah status, link WA, signed URL bukti, badge lunas otomatis), Batch (CRUD + buka/tutup), Produk (harga, aktif), Ekspor (CSV)

## Route API (server-side, service role)
Ada karena RLS menutup akses anon ke `orders`/`order_items`.
- `POST /api/pesanan` — validasi input, cek ada batch buka, **hitung ulang total dari harga di DB** (jangan percaya harga dari browser), insert order + items. Rollback order kalau insert item gagal.
- `GET /api/pesanan/[id]` — detail satu pesanan buat halaman bayar. Nomor WA sengaja tidak dikirim balik.
- `POST /api/pesanan/[id]/bukti` — upload multipart, maks 5 MB, whitelist jpg/png/webp/heic. Simpan **path**-nya ke `orders.payment_proof_url`.
- `POST /api/pesanan/[id]/qris` — charge QRIS Midtrans (30 menit). Kalau intent terakhir masih pending & sisa > 1 menit, kembalikan yang lama (reload ≠ charge baru).
- `GET /api/pesanan/[id]/qris` — status buat polling. Kalau pending & `checked_at` > 8 detik lalu, tanya Midtrans langsung (cadangan kalau webhook gagal/localhost).
- `GET /api/pesanan/[id]/qris/gambar` — proxy unduh gambar QR (URL diambil dari DB, host harus *.midtrans.com).
- `POST /api/midtrans/notifikasi` — webhook. Verifikasi signature → lookup `payment_intents.order_ref` → **ambil ulang status dari API Midtrans** → `applyStatus`. Error sementara dibalas 503 (Midtrans retry 4x). order_ref tak dikenal → 200 (abaikan).

## Midtrans (`lib/midtrans.js`)
- `order_ref` = `KRP-{8 char uuid}-{timestamp base36}` (≤ 50 char), primary key `payment_intents` → tidak ada parsing string
- `applyStatus(db, intent, st)` dipakai webhook DAN polling, harus idempoten:
  - lunas hanya kalau `settlement`/`capture` + fraud accept/kosong + **gross_amount == intent.amount** (beda → status `nominal_beda`, orders tidak disentuh)
  - `orders.paid_at` diisi dengan guard `is null`; `status='lunas'` hanya dari `baru`/`menunggu_konfirmasi`
- `expiry_time` Midtrans = WIB tanpa zona → `parseExpiry` tambah `+07:00`
- `MIDTRANS_NOTIFICATION_URL` dikirim sebagai header `X-Override-Notification` per charge
- Uji unit tanpa akun Midtrans: salin ke .mjs lalu jalankan (lihat riwayat sesi); `midtransReady` false kalau key diawali `ISI_`/`isi-`

## Database
- `supabase/schema.sql` — skema awal (products, orders, order_items, seed 12 produk)
- `supabase/migration-batch-auth.sql` — batch, admins, RLS ketat, bucket privat
- `supabase/migration-midtrans.sql` — `payment_intents`, `orders.paid_at`, `orders.paid_via`
- Ketiga file WAJIB dijalankan urut — kode membaca kolom dari semuanya
- `supabase/migration-menu-poster.sql` — `products.weight`, `badge` (FAVORIT/BARU), `sort_order` (urutan poster). Opsional: tanpa ini web tetap jalan, berat/badge tidak tampil & katalog urut abjad
- `batches`: id, name, status (`buka`/`tutup`), note, created_at, closed_at
  - Unique index parsial `batches_hanya_satu_buka` → cuma boleh SATU batch `status='buka'`
  - Karena itu, membuka batch harus menutup yang lain dulu (lihat `components/admin/Batches.jsx`)
- `orders`: + `batch_id`, `paid_at`, `paid_via` (`midtrans`/`manual`)
- `payment_intents`: order_ref (PK), order_id, amount, status (transaction_status Midtrans terakhir), qr_url, expiry_time, payload, notif, checked_at, paid_at. RLS: admin baca; insert/update/delete dikunci policy RESTRICTIVE (server only)
- `admins`: user_id (FK auth.users), email. Helper `public.is_admin()` dipakai semua policy RLS
- Status pesanan: baru → menunggu_konfirmasi → lunas → diproses → selesai / batal. Dianggap sudah bayar: `paid_at` terisi ATAU status lunas/diproses/selesai
- RLS: `products`/`batches` boleh dibaca publik, tulis khusus admin. `orders`/`order_items` admin only
- Bucket `bukti` privat — admin baca lewat `createSignedUrl` (5 menit)
- Foto produk: file lokal di `public/produk/*.jpg`, image_url berisi path relatif `/produk/...`
- Sumber menu, foto asli & poster: `../../Kerjaan/Jualan kripik/` (poster = sumber kebenaran nama/harga/berat)
- `batagor-kering-pedes.jpg` = potongan 170px dari poster Hal 1 (SEMENTARA — foto asli belum ada)

## Status saat ini (dicek 2026-09-14)
- Build lolos (`npm run build`), `node_modules` terpasang
- `supabase/schema.sql` SUDAH dijalankan — 12 produk aktif, belum ada pesanan
- `migration-batch-auth.sql` & `migration-midtrans.sql` SUDAH dijalankan — Batch 1 berstatus buka, anon ditolak RLS saat ubah produk, bucket `bukti` privat
- Admin terdaftar: `admin@example.com` (didaftarkan manual 2026-09-14 — email di migrasi tidak cocok user mana pun)
- Project Supabase `cxrkrpnlubakmzlrckaj` sempat ter-pause (free plan, 7 hari sepi), di-restore 2026-09-14. Perlu pencegah pause (ping cron / Pro) sebelum jualan beneran
- `SUPABASE_SERVICE_ROLE_KEY` terisi & valid. `MIDTRANS_SERVER_KEY` masih placeholder (`ISI_SERVER_KEY_MIDTRANS`) → QRIS otomatis belum aktif
- Alur Midtrans end-to-end BELUM dites ke sandbox — baru uji unit (signature, expiry, applyStatus) + build
- Pertanyaan terbuka: pakai akun Midtrans elevra (sudah production, QRIS aktif) atau akun baru khusus kripik
- `public/qris.png` masih placeholder (600x700)
- Menu & harga sesuai poster 13 Sep 2026: 15 aktif, Sale Pisang Jari nonaktif (bukan dihapus). `migration-menu-poster.sql` BELUM dijalankan
- Ada 2 pesanan tes atas nama "Rama" (29 Agu, harga lama, status baru) di Batch 1
- `npm audit`: Next.js 14.2.x kena advisory high (fix-nya upgrade ke Next 16, breaking) — dibiarkan dulu

## Konvensi
- Pakai `rupiah()` dari `lib/supabase.js` untuk format harga
- CSV lewat `lib/csv.js` (`downloadCsv`, `slug`) — tanpa library tambahan
- Jangan tambah TypeScript/library baru tanpa perlu (`server-only` & SDK `midtrans-client` sengaja tidak dipakai — cukup fetch)
- Jaga tampilan mobile-first: container `max-w-md`, tombol besar, rounded-2xl
- Komponen admin dipecah ke `components/admin/*.jsx`, `app/admin/page.jsx` cuma shell + auth
- Kontak toko (WA PO 0855-9119-1217) di `lib/toko.js` — jangan hardcode nomor di komponen
- Matikan dev server lewat PID port-nya (`lsof -tiTCP:3001`), JANGAN `pkill -f "next dev"` — ikut membunuh dev server project lain
