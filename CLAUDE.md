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
- Auth pembeli: Supabase Auth **Google** (`lib/auth.js`: `masukGoogle`, `useSesi`, `fetchAuth`, `namaAkun`). Wajib login sebelum pesan.
  Route API memverifikasi token lewat `lib/auth-server.js` (`userDariRequest`) — jangan percaya user_id dari browser
- State keranjang: React Context + localStorage (`lib/cart.js`)
- Pembayaran SEKARANG: **manual** — QRIS statis yang diupload admin (bucket publik `toko`, URL di `settings.qris_url`) → pembeli upload foto bukti → admin ACC/Tolak. Boleh bayar belakangan.
- QRIS otomatis **Midtrans Snap** (`lib/midtrans.js`, server-only) DISEMBUNYIKAN: aktif cuma kalau `QRIS_OTOMATIS=true` DAN `MIDTRANS_SERVER_KEY` diisi.
  Bukan Core API: Core API belum diaktifkan Midtrans di akun ini (semua charge 402 "Payment channel is not activated"), Snap aktif.
  Kalau mati → jalur manual di atas; bukti ke bucket `bukti` (privat). `public/qris.png` sudah tidak dipakai
- Pola Midtrans mengikuti project `../elevra-grad-main` (supabase/functions/midtrans-payment & midtrans-callback)
- Tanpa ongkir — total = harga × qty saja. Fee MDR TIDAK dibebankan ke pembeli
- Pengantaran KHUSUS ke Capital Place (tulis "Capital Place" saja, tanpa "Indosat") (`LOKASI_ANTAR` di `lib/toko.js`) — tampil di katalog (bawah hero), kotak total keranjang, ringkasan bayar (`InfoAntar`), dan meta description

## Halaman
- `/` — katalog (`products` aktif) + banner batch. Kalau tidak ada batch `status='buka'`: tombol pesan mati, gambar grayscale, keranjang otomatis dikosongkan
- `/keranjang` — edit qty; belum login → tombol "Masuk dengan Google" (balik ke /keranjang, isi keranjang tetap); sudah login → form (nama dari Google, WA diingat di localStorage `kripik-wa`) → POST `/api/pesanan` pakai `fetchAuth` → `/bayar/[id]`
- `/bayar/[id]` — GET `/api/pesanan/[id]` (field `bayar_otomatis` menentukan mode):
  - otomatis: POST `/api/pesanan/[id]/qris` → tombol "Bayar dengan QRIS" ke halaman Snap (`pay_url`) + countdown; polling GET `/qris` tiap 4 detik, langsung cek saat pembeli balik dari Snap
  - manual (default): QRIS dari `settings.qris_url` + "Sudah Bayar? Upload Bukti" → POST `/api/pesanan/[id]/bukti`; "Bayar nanti aja" → `/pesanan`; alasan tolak admin (`bukti_ditolak`) tampil; saat `menunggu_konfirmasi` bisa "Ganti foto bukti"
  - pesanan milik akun & belum login → layar "Masuk dulu" (API balas 401 `perlu_login`)
- `/pesanan` — Pesanan Saya (baca langsung via RLS `pesanan baca pemilik`). Label pembeli: Belum bayar / Bukti dicek / Bukti ditolak / Sudah bayar / Diproses / Selesai / Dibatalkan
- `/admin` — login Supabase Auth. 4 tab: Pesanan (filter batch, ubah status, link WA, signed URL bukti, badge lunas otomatis), Batch (CRUD + buka/tutup), Produk (harga, aktif), Ekspor (CSV)

## Route API (server-side, service role)
Ada karena RLS menutup akses anon ke `orders`/`order_items`.
- `POST /api/pesanan` — WAJIB login Google (401 tanpa token valid). Validasi input, cek ada batch buka, **hitung ulang total dari harga di DB** (jangan percaya harga dari browser), insert order (+ `user_id`, `customer_email`) + items. Rollback order kalau insert item gagal.
- `GET /api/pesanan/[id]` — detail satu pesanan buat halaman bayar. Nomor WA sengaja tidak dikirim balik. Pesanan ber-`user_id` cuma untuk pemiliknya (tanpa login → 401 `perlu_login`, akun lain → 404); pesanan lama tanpa akun tetap bisa lewat link.
- `POST /api/pesanan/[id]/bukti` — upload multipart, maks 5 MB, whitelist jpg/png/webp/heic. Simpan **path**-nya ke `orders.payment_proof_url`, status → `menunggu_konfirmasi`, kosongkan `proof_note`. Pemilik saja; boleh upload ulang; ditolak kalau sudah dibayar/batal.
- `POST /api/pesanan/[id]/qris` — bikin transaksi Snap (`enabled_payments: ["other_qris"]`, expiry 30 menit, `callbacks.finish` → `/bayar/[id]`). Link bayar di `payment_intents.payload.redirect_url`. Kalau intent terakhir masih pending & sisa > 1 menit, kembalikan yang lama (reload ≠ transaksi baru).
- `GET /api/pesanan/[id]/qris` — status buat polling. Kalau pending & `checked_at` > 8 detik lalu, tanya Midtrans langsung (cadangan kalau webhook gagal/localhost).
- `POST /api/midtrans/notifikasi` — webhook. Verifikasi signature → lookup `payment_intents.order_ref` → **ambil ulang status dari API Midtrans** → `applyStatus`. Error sementara dibalas 503 (Midtrans retry 4x). order_ref tak dikenal → 200 (abaikan).

## Midtrans (`lib/midtrans.js`)
- `order_ref` = `KRP-{8 char uuid}-{timestamp base36}` (≤ 50 char), primary key `payment_intents` → tidak ada parsing string
- `applyStatus(db, intent, st)` dipakai webhook DAN polling, harus idempoten:
  - lunas hanya kalau `settlement`/`capture` + fraud accept/kosong + **gross_amount == intent.amount** (beda → status `nominal_beda`, orders tidak disentuh)
  - `orders.paid_at` diisi dengan guard `is null`; `status='lunas'` hanya dari `baru`/`menunggu_konfirmasi`
- Transaksi Snap baru "ada" di Midtrans setelah pembeli pilih metode; sebelum itu Get Status balas `status_code: "404"` (HTTP 200) → dianggap pending
- `MIDTRANS_NOTIFICATION_URL` dikirim sebagai header `X-Override-Notification` saat bikin transaksi Snap
- Uji unit tanpa akun Midtrans: salin ke .mjs lalu jalankan (lihat riwayat sesi); `midtransReady` false kalau key diawali `ISI_`/`isi-`

## Database
- `supabase/schema.sql` — skema awal (products, orders, order_items, seed 12 produk)
- `supabase/migration-batch-auth.sql` — batch, admins, RLS ketat, bucket privat
- `supabase/migration-midtrans.sql` — `payment_intents`, `orders.paid_at`, `orders.paid_via`
- Ketiga file WAJIB dijalankan urut — kode membaca kolom dari semuanya
- `supabase/migration-menu-poster.sql` — `products.weight`, `badge` (FAVORIT/BARU), `sort_order` (urutan poster). Opsional: tanpa ini web tetap jalan, berat/badge tidak tampil & katalog urut abjad
- `supabase/migration-login-bayar-manual.sql` — WAJIB: `orders.user_id` / `customer_email` / `proof_note`; RLS pembeli baca pesanan & item miliknya; tabel `settings` (key/value, baca publik, tulis admin); bucket publik `toko` (upload/hapus admin)
- `batches`: id, name, status (`buka`/`tutup`), note, created_at, closed_at
  - Unique index parsial `batches_hanya_satu_buka` → cuma boleh SATU batch `status='buka'`
  - Karena itu, membuka batch harus menutup yang lain dulu (lihat `components/admin/Batches.jsx`)
- `orders`: + `batch_id`, `paid_at`, `paid_via` (`midtrans`/`manual`)
- `payment_intents`: order_ref (PK), order_id, amount, status (transaction_status Midtrans terakhir), qr_url, expiry_time, payload, notif, checked_at, paid_at. RLS: admin baca; insert/update/delete dikunci policy RESTRICTIVE (server only)
- `admins`: user_id (FK auth.users), email. Helper `public.is_admin()` dipakai semua policy RLS
- Status pesanan: baru → menunggu_konfirmasi → lunas → diproses → selesai / batal. Dianggap sudah bayar: `paid_at` terisi ATAU status lunas/diproses/selesai
  - Label admin: `baru` = Belum Bayar, `lunas` = Sudah Bayar. ACC = set `lunas`. Tolak = `baru` + `proof_note` (alasan) + `payment_proof_url` null
  - Admin ubah status ke lunas/diproses/selesai → `paid_at` diisi (`paid_via` manual); balik ke baru/menunggu → `paid_at` dikosongkan (kecuali dari midtrans)
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
- `.env.local`: service role key & Midtrans Server Key SANDBOX terisi (akun Midtrans baru, merchant "ramcode"; key sandbox tanpa awalan `SB-`)
- Alur Snap end-to-end SUDAH lolos di sandbox (2026-09-14): sesi bayar → simulator QRIS → polling & webhook → pesanan lunas, idempoten, signature palsu ditolak
- Di web live juga terbukti: webhook (header `X-Override-Notification`) sampai & menandai lunas TANPA polling. Settlement sandbox kadang telat beberapa menit setelah simulator bilang PAID
- Midtrans production BELUM diaktivasi — link untuk form aktivasi: https://kripik.ramcode.site. Sampai aktif, QRIS otomatis disembunyikan (`QRIS_OTOMATIS` jangan diisi di Vercel)
- Login Google + bayar manual SUDAH dikodekan: `migration-login-bayar-manual.sql` BELUM dijalankan & provider Google BELUM aktif di Supabase (per 2026-09-14). Tanpa migrasi, halaman bayar & pembuatan pesanan gagal — jangan push/deploy sebelum migrasi jalan
- GitHub: `ramdotcode/po-kripik` (PUBLIK). Push via SSH alias `github.com-ramdotcode`; identitas git lokal ramdotcode <ramdotcode@gmail.com>
- LIVE di https://kripik.ramcode.site — Vercel project `po-kripik` (preset Next.js, deploy otomatis dari push ke `main`, env lengkap). DNS Cloudflare: CNAME → Vercel, DNS only
- Region: Supabase di AWS **ap-southeast-2 (Sydney)** → Vercel Function Region di-set **syd1**. Request pesanan ~0,4–0,9 dtk (dulu iad1 1–2 dtk, sin1 ~1,2 dtk)
- `public/qris.png` masih placeholder (600x700)
- Menu & harga sesuai poster 13 Sep 2026: 15 aktif, Sale Pisang Jari nonaktif (bukan dihapus). `migration-menu-poster.sql` BELUM dijalankan
- Pesanan tes di Batch 1: 2 atas nama "Rama" (29 Agu, harga lama, status baru) + "TES Midtrans (Claude)" #4e804787 & "TES Live Webhook (Claude)" #e12f537a (Kremes Ubi, lunas via sandbox) — semua perlu ditandai Batal
- `npm audit`: Next.js 14.2.x kena advisory high (fix-nya upgrade ke Next 16, breaking) — dibiarkan dulu

## Konvensi
- Pakai `rupiah()` dari `lib/supabase.js` untuk format harga
- CSV lewat `lib/csv.js` (`downloadCsv`, `slug`) — tanpa library tambahan
- Jangan tambah TypeScript/library baru tanpa perlu (`server-only` & SDK `midtrans-client` sengaja tidak dipakai — cukup fetch)
- Jaga tampilan mobile-first: container `max-w-md`, tombol besar (≥ 44px), kartu rounded-3xl, tombol pill
- UI pembeli (redesign 14 Sep 2026, ikut mockup user): font `next/font` Plus Jakarta Sans (semua teks) + Lilita One (`font-display`, cuma logo & stiker); warna teks `coklat-900`
  - Kelas bersama di `app/globals.css`: `.btn-oranye` (CTA gradasi), `.btn-lembut`, `.kartu`, `.input`
  - `components/Brand.jsx`: Logo (SVG keranjang, sama dengan `app/icon.svg`), CaraPesan (prop `aktif` 1–3 dipakai di halaman bayar), Stepper, HeaderHalaman, FooterWa, Stempel, hiasan
  - `components/Ikon.jsx`: ikon SVG gaya Lucide digambar manual — JANGAN tambah library ikon
  - Katalog: hero batch (foto `rengginang.jpg` + stiker "Stok terbatas!"), Cara Pesan, dropdown Urutkan (client-side), bar keranjang melayang
  - Admin ikut gaya yang sama: header terang sticky + tab pill. Pesanan: ringkasan (nilai, jumlah tanpa batal, bar sudah dibayar), cari nama/kode/WA, filter status, kode #8 char, status berwarna (+ konfirmasi saat batal, revert kalau gagal), tombol "Tandai Lunas" untuk `menunggu_konfirmasi`, pratinjau bukti di modal. Batch: jumlah pesanan per batch, konfirmasi buka/tutup. Produk: saklar aktif. Link WA pembeli lewat `waPembeli()` di `lib/toko.js`
- Komponen admin dipecah ke `components/admin/*.jsx`, `app/admin/page.jsx` cuma shell + auth
- Kontak toko (WA PO 0855-9119-1217) di `lib/toko.js` — jangan hardcode nomor di komponen
- Push ke GitHub selalu lewat remote `git@github.com-ramdotcode:ramdotcode/po-kripik.git` (alias `github.com` biasa = akun lain)
- Push ke `main` memicu deploy production Vercel — pastikan env var di Vercel sudah lengkap dulu
- Matikan dev server lewat PID port-nya (`lsof -tiTCP:3001`), JANGAN `pkill -f "next dev"` — ikut membunuh dev server project lain
