# Brief UI/UX — PO Kripik

Bahan buat redesign. Isinya: kebutuhan web, apa saja yang ada di tiap halaman (data, tombol, state), aturan yang **nggak boleh dilanggar** desain baru, dan screenshot kondisi sekarang.

> Screenshot diambil 14 Sep 2026 di ukuran iPhone (390 px, @2x). Datanya **dummy** biar semua kondisi kelihatan: nama pembeli, batch, dan pesanan contoh. Berat & badge produk ditampilkan seolah `migration-menu-poster.sql` sudah dijalankan. Gambar QR di mode otomatis masih placeholder.

---

## 1. Gambaran singkat

**Apa ini:** web pre-order (PO) kripik & camilan. Pembeli pesan online, bayar QRIS, lalu tunggu barangnya jadi. Pesanan dikelompokkan per **batch PO** yang dibuka/ditutup penjual.

**Pengguna:**

| Siapa | Konteks | Yang dia mau |
|---|---|---|
| **Pembeli** | Buka dari link di WA/IG/status, **di HP**, sering sambil lalu | Lihat menu, cepat pesan, bayar, yakin pesanannya masuk |
| **Admin (penjual)** | Juga **di HP**, cek pesanan sambil produksi | Tahu siapa sudah bayar, ubah status, buka/tutup PO, tahu harus bikin berapa |

**Alur utama pembeli:**

```
Katalog ──(+ Tambah)──► Keranjang ──(isi nama & WA, Buat Pesanan)──► Pembayaran ──► Selesai
                                                                    ├─ QRIS otomatis (Midtrans) → lunas sendiri
                                                                    └─ QRIS statis → upload bukti → dicek admin
```

**Alur admin:** Login → tab **Pesanan · Batch · Produk · Ekspor**.

---

## 2. Aset & gaya visual yang sudah ada

### Warna (Tailwind `brand`)
| Token | Hex | Dipakai buat |
|---|---|---|
| brand-50 | `#fff8ed` | Latar halaman |
| brand-100 | `#ffefd4` | Kotak total, tombol sekunder, stepper − |
| brand-500 | `#f97316` | Header, tombol Tambah, stepper + |
| brand-600 | `#ea580c` | CTA utama, harga, link |
| brand-700 | `#c2410c` | Angka total |
| stone-800 | `#292524` | Header admin, teks utama |
| red-600 | `#dc2626` | Badge FAVORIT/BARU, pesan error |
| green-100/700 | `#dcfce7` / `#15803d` | Lunas, Aktif, Buka |

### Bentuk & tipografi
- **Font:** belum ada font khusus — pakai font bawaan HP (SF Pro di iPhone, Roboto di Android).
- **Radius:** kartu & tombol `16px` (rounded-2xl), input `12px`, pill/stepper bulat penuh.
- **Ikon:** semuanya **emoji** (🧺 🛒 💾 📤 ✅ ⌛ 😴). Belum ada set ikon.
- **Bayangan:** kartu `shadow-sm`, CTA `shadow-lg`.
- **Layout:** satu kolom lebar maks `448px` (max-w-md), di laptop jadi kolom di tengah dengan sisi kosong (lihat `00-desktop-katalog.png`).

### Aset
- **Foto produk:** 17 file di `public/produk/` (±432×476 px). Kualitas & latar **nggak seragam** (ada yang putih, meja, plastik, ada stiker) → desain sebaiknya tahan sama foto yang beda-beda.
- **Poster** di `Kerjaan/Jualan kripik/` (sumber kebenaran nama/harga/berat): gaya oranye + outline coklat tua, judul tebal membulat, pita nama, harga di stempel bergerigi ("29K"), foto bulat, badge merah ★ FAVORIT / ★ BARU. **Web belum ikut gaya poster ini** — peluang bikin brand-nya nyambung.
- **QRIS statis:** `public/qris.png` masih placeholder (600×700).
- **Belum ada:** logo, favicon, gambar share (OG image) buat link WA.

---

## 3. Halaman pembeli

### 3.1 Katalog — `/`
**Tujuan:** lihat menu, pilih, masuk keranjang.

**Data yang tampil**
- Header: nama toko + tagline.
- Banner batch: label "PO lagi buka", **nama batch**, **catatan batch** (opsional, mis. "Ambil / kirim Sabtu 4 Okt").
- Kartu produk (15 aktif, grid 2 kolom): **foto**, **nama**, **harga**, **berat** (opsional, "/ 250gr"), **badge** (opsional: FAVORIT / BARU).
  - Nama bisa panjang banget: *"Soes Kering Isi Coklat/Susu Vanilla/Blueberry/Keju Lumer"* (56 karakter).
  - Urutan ikut poster (`sort_order`).
- Footer: "Tanya-tanya soal PO? WhatsApp 0855-9119-1217" (link WA dengan pesan terisi).
- Bar keranjang menempel di bawah: **jumlah item** + **total harga** → ke Keranjang.

**Aksi:** + Tambah · stepper − qty + · buka keranjang · chat WA.

**State yang harus didesain**
| State | Kondisi | Screenshot |
|---|---|---|
| Memuat | Data belum datang ("Memuat produk…") | — |
| PO buka, keranjang kosong | Normal | `01` |
| PO buka, ada isi keranjang | Kartu berubah jadi stepper + bar bawah muncul | `02` |
| **PO tutup** | Nggak ada batch buka → foto grayscale, tombol diganti "PO lagi tutup", keranjang **otomatis dikosongkan** | `03` |
| Tampilan laptop | Kolom tengah | `00` |

---

### 3.2 Keranjang — `/keranjang`
**Tujuan:** cek pesanan, isi data diri, kirim pesanan.

**Data & input**
- Daftar item: foto kecil, nama, harga satuan, stepper qty (qty 0 = item hilang).
- Kotak **Total**.
- Info "Pesanan masuk ke **{nama batch}**".
- Form:
  - **Nama** — wajib.
  - **No. WhatsApp** — wajib, 8–20 karakter, cuma angka / `+ - ( )` / spasi.
  - **Catatan** — opsional.
- Tombol **"Buat Pesanan • Rp xxx"** → sukses langsung pindah ke halaman Pembayaran.

**Pesan error dari server (harus ada tempatnya di desain)**
- Nama wajib diisi.
- Nomor WhatsApp tidak valid.
- Keranjang kosong.
- PO lagi tutup, belum bisa pesan.
- Ada produk yang sudah tidak tersedia.
- "{Nama produk}" lagi kosong.
- Jumlah pesanan tidak wajar. *(qty 1–999)*
- Gagal menghubungi server. Cek koneksi internetmu.

**State**
| State | Screenshot |
|---|---|
| Terisi | `04` |
| Error validasi | `05` |
| Kosong ("Keranjang masih kosong" + link balik) | `06` |
| PO tutup (banner + tombol mati) | `07` |
| Mengirim ("Menyimpan…", tombol mati) | — |

---

### 3.3 Pembayaran — `/bayar/[id]`
**Tujuan:** bayar, dan yakin pembayarannya diterima.

> Link halaman ini = kunci pesanan (ID acak). **Pembeli nggak punya cara lain buat balik ke pesanannya** kalau tab-nya ketutup.

**Selalu tampil**
- Header: "Pembayaran", **kode pesanan** (8 karakter, mis. #5f3c9a10), nama batch.
- Ringkasan: tiap item (nama × qty, subtotal), **Total**, catatan batch.
- Link "Ada kendala pembayaran? WhatsApp …" (pesan terisi kode pesanan).

**Mode A — QRIS otomatis (Midtrans)** *— kodenya sudah siap, tapi BELUM aktif (server key belum diisi)*
- QR dinamis + nominal.
- **Hitung mundur** mm:ss (QR berlaku 30 menit).
- Tombol **"Simpan QR ke Galeri"** + tips: bayar dari HP yang sama → simpan QR → di e-wallet pilih scan dari galeri.
- Indikator **"Menunggu pembayaran…"** — halaman cek status tiap 4 detik dan berubah sendiri begitu lunas.

**Mode B — QRIS statis + upload bukti** *— ini yang AKTIF sekarang*
- Gambar QRIS toko + nominal yang harus dibayar.
- Tombol **"Upload Bukti Pembayaran"** (buka galeri/kamera). Format JPG/PNG/WEBP/HEIC, maks 5 MB.
- Setelah upload → "Bukti pembayaran diterima! Pesananmu sedang kami cek."

**State**
| State | Mode | Screenshot |
|---|---|---|
| Memuat | semua | — |
| QRIS statis, belum bayar | B | `08` |
| Mengupload | B | — |
| Error upload (kebesaran / format salah / koneksi) | B | — |
| Bukti terkirim | B | `09` |
| Menyiapkan QR | A | — |
| QR aktif + countdown | A | `10` |
| Nominal beda (uang masuk tapi jumlahnya beda) | A | `11` |
| QR kedaluwarsa → "Bikin QR Baru" | A | `12` |
| Gagal bikin QR → "Coba lagi" | A | — |
| **Lunas** 🎉 | semua | `13` |
| Dibatalkan | semua | `14` |
| Pesanan tidak ditemukan | semua | `15` |

---

## 4. Halaman admin — `/admin`

Header gelap (beda dari pembeli): judul, indikator **"🟢 {batch} lagi buka" / "🔴 Semua batch tutup"**, tombol Keluar, 4 tab pill.

### 4.1 Login & akses
- Email + password, error "Email atau password salah.", tombol "Memeriksa…". → `20`
- Akun login tapi bukan admin → layar ditolak + Keluar. → `21`

### 4.2 Tab Pesanan → `22`
- **Filter batch** (dropdown: Semua batch / per batch).
- **Ringkasan:** jumlah pesanan + total rupiah (tanpa yang batal).
- **Kartu pesanan:** nama pembeli, **no. WA (klik → buka chat WA)**, waktu pesan, nama batch, badge lunas (*💳 Lunas otomatis (QRIS)* / *💰 Sudah dibayar*), total, daftar item, catatan pembeli.
- **Ubah status** (dropdown, langsung tersimpan) + tombol **Lihat Bukti** (kalau pembeli upload; buka di tab baru, link berlaku 5 menit).
- State: memuat, belum ada pesanan.

### 4.3 Tab Batch → `23`
- Form **batch baru**: nama (kosong = otomatis "Batch N"), catatan buat pembeli. Batch baru selalu dibuat dalam keadaan **tutup**.
- Kartu tiap batch: nama (bisa diedit langsung), pill Buka/Tutup, catatan (bisa diedit langsung), tanggal dibuat/ditutup, tombol **Buka PO ini / Tutup PO ini**.
- Hanya **satu** batch boleh buka. Membuka batch otomatis menutup yang lain (ada teks peringatannya).

### 4.4 Tab Produk → `24`
- Semua produk (termasuk nonaktif): foto, nama, **input harga** (tersimpan saat keluar dari kolom, muncul "✅ tersimpan"), tombol **Aktif / Nonaktif**.
- Tambah produk, ganti foto/nama/berat/badge/urutan: **belum bisa dari web** (lewat dashboard Supabase).

### 4.5 Tab Ekspor → `25`
- Pilih batch → 2 tombol unduh CSV:
  - **Ekspor Pesanan (detail):** Batch, Waktu, Kode, Nama, WhatsApp, Produk, Harga, Qty, Subtotal, Status, Dibayar, Catatan.
  - **Rekap per Produk:** Produk, Total Qty, Total Rupiah (+ baris TOTAL) — buat tahu harus produksi berapa.
- Pesan hasil ("✅ 12 baris terunduh." / "Belum ada pesanan di batch ini.").

---

## 5. Status pesanan

| Kode | Label admin | Artinya | Yang dilihat pembeli |
|---|---|---|---|
| `baru` | 🆕 Baru | Baru pesan, belum bayar | Halaman bayar |
| `menunggu_konfirmasi` | 🕐 Cek Bukti | Sudah upload bukti | "Bukti diterima, sedang dicek" |
| `lunas` | 💰 Lunas | Uang masuk | "Pembayaran berhasil" |
| `diproses` | 👩‍🍳 Diproses | Lagi dibikin | "Pembayaran berhasil" *(sama)* |
| `selesai` | ✅ Selesai | Sudah diambil/dikirim | "Pembayaran berhasil" *(sama)* |
| `batal` | ❌ Batal | Dibatalkan | "Pesanan ini sudah dibatalkan" |

Dianggap sudah bayar kalau `paid_at` terisi **atau** status lunas/diproses/selesai.

---

## 6. Aturan yang WAJIB tetap dipenuhi desain baru

1. **Mobile-first.** Target utama HP; tombol besar & gampang dipencet jempol.
2. **Bahasa Indonesia, nada santai** ("PO lagi tutup", "Bikin QR Baru").
3. **Cuma satu batch buka.** Kalau tutup: nggak bisa pesan sama sekali, dan pembeli harus langsung paham.
4. **Tanpa ongkir & tanpa biaya tambahan.** Total = harga × qty. Jangan desain baris ongkir/fee.
5. **Harga di layar cuma tampilan** — server menghitung ulang. Aman buat desain apa pun, asal angkanya dari data.
6. **Nomor WA pembeli nggak ditampilkan lagi** di halaman bayar (privasi). Jangan taruh di sana.
7. **Dua mode bayar harus ada desainnya:** QRIS otomatis (nanti) & QRIS statis + upload bukti (sekarang).
8. **QR otomatis berlaku 30 menit**; reload halaman menampilkan QR yang sama selama sisa > 1 menit.
9. **Upload bukti:** gambar saja (JPG/PNG/WEBP/HEIC), maks 5 MB.
10. **Kontak toko** satu nomor: **0855-9119-1217** (WhatsApp).
11. **Data opsional harus aman kalau kosong:** catatan batch, berat, badge, catatan pembeli.
12. **Bisa dibangun pakai Tailwind** tanpa library UI berat. Font Google (mis. Poppins, mirip poster) boleh.

---

## 7. Masalah UX yang kelihatan sekarang (bahan perbaikan)

**Pembeli**
- Nggak ada penjelasan **cara kerja PO** (pesan → bayar → tunggu batch → ambil/kirim) dan **kapan barang jadi** — cuma bergantung ke catatan batch.
- Nggak ada identitas brand: header cuma emoji + teks; beda jauh dari poster.
- Tombol stepper 32–36 px (disarankan ≥ 44 px). Tombol − dan + tanpa label buat pembaca layar.
- Kontras kurang: teks abu `#a8a29e` di latar krem, dan teks putih di oranye `#f97316`.
- Form cuma pakai **placeholder** (tanpa label). Error muncul di bawah form, bukan di kolom yang salah.
- Nggak ada tombol **hapus item** & **subtotal per item** di keranjang.
- Nggak ada feedback saat **+ Tambah** (animasi/toast).
- Memuat cuma teks — belum ada skeleton.
- Halaman bayar: kalau tab ketutup, **pesanan hilang dari pembeli**. Belum ada "salin link / simpan halaman ini".
- Setelah lunas, status diproses/selesai terlihat sama → belum ada **pelacak status**.
- Nama pembeli nggak disapa di halaman bayar (datanya ada).

**Admin**
- Ringkasan bilang "tanpa yang batal" tapi **jumlah pesanannya ikut menghitung yang batal** (angka rupiahnya sudah benar).
- **Kode pesanan nggak tampil** di kartu admin, padahal pembeli chat pakai kode "#5f3c9a10".
- Nggak ada filter per status / cari nama.
- Ubah status langsung tersimpan tanpa konfirmasi/undo; tanpa tanda "tersimpan".
- Bukti transfer dibuka di tab baru (bukan pratinjau).
- Edit nama/catatan batch tersimpan diam-diam (tanpa feedback). Tutup PO tanpa konfirmasi.
- Nggak ada jumlah pesanan per batch di tab Batch.

---

## 8. Ide fitur tambahan (opsional — tandai mana yang mau)

| Ide | Butuh ubah backend? |
|---|---|
| Section "Cara pesan" 3 langkah di katalog | Tidak |
| Skeleton loading, toast "ditambahkan", animasi bar keranjang | Tidak |
| Tombol hapus item + subtotal per item | Tidak |
| Tombol "Salin link pesanan" / "Kirim ke WA-ku" di halaman bayar | Tidak |
| Pelacak status (Baru → Lunas → Diproses → Selesai) di halaman bayar | Tidak (data sudah ada) |
| Kode pesanan + filter status + pencarian di admin | Tidak |
| Tombol cepat "Tandai Lunas" di kartu admin | Tidak |
| Deskripsi / rasa / level pedas per produk | Ya (kolom baru) |
| Kategori (Kripik, Kue kering, …) | Ya |
| Tanggal tutup PO otomatis + hitung mundur di banner | Ya |
| Kuota/stok per batch ("sisa 5") | Ya |
| Pilihan ambil sendiri / dikirim | Ya |
| Cek pesanan pakai nomor WA | Ya |
| Tambah produk + upload foto dari admin | Ya |

---

## 9. Daftar layar yang perlu didesain

**Pembeli (±16 frame)**
1. Katalog — PO buka
2. Katalog — ada isi keranjang
3. Katalog — PO tutup
4. Katalog — memuat (skeleton)
5. Keranjang — terisi
6. Keranjang — error
7. Keranjang — kosong
8. Keranjang — PO tutup
9. Bayar statis — belum bayar
10. Bayar statis — bukti terkirim
11. Bayar otomatis — QR aktif
12. Bayar otomatis — kedaluwarsa
13. Bayar otomatis — nominal beda / error
14. Bayar — lunas
15. Bayar — batal
16. Bayar — tidak ditemukan

**Admin (±7 frame)**
1. Login
2. Bukan admin
3. Pesanan (+ state kosong)
4. Batch
5. Produk
6. Ekspor
7. (Opsional) Detail pesanan / pratinjau bukti

**Komponen yang dipakai berulang**
Header · Banner batch · Kartu produk (Tambah / stepper / tutup) · Badge FAVORIT/BARU · Bar keranjang bawah · Baris item keranjang · Kotak total · Input & textarea (normal / fokus / error) · Tombol utama (normal / loading / mati) · Tombol sekunder · Kotak info (sukses / error / netral / menunggu) · Countdown · Kartu QR · Tombol upload · Pill status · Dropdown · Tab admin · Kartu pesanan admin · Kartu batch · Baris produk admin.

---

## 10. Daftar screenshot

| File | Isi |
|---|---|
| `00-desktop-katalog.png` | Katalog dibuka di laptop (1280 px) |
| `01-katalog-po-buka.png` | Katalog normal (halaman penuh) |
| `02-katalog-ada-keranjang.png` | Ada 3 produk di keranjang, bar bawah muncul |
| `03-katalog-po-tutup.png` | Nggak ada batch buka |
| `04-keranjang-terisi.png` | Keranjang + form |
| `05-keranjang-error-validasi.png` | No. WA salah |
| `06-keranjang-kosong.png` | Keranjang kosong |
| `07-keranjang-po-tutup.png` | Keranjang saat PO tutup |
| `08-bayar-manual-qris-statis.png` | Mode sekarang: QRIS statis + upload |
| `09-bayar-manual-bukti-terkirim.png` | Setelah upload bukti |
| `10-bayar-otomatis-qris-midtrans.png` | Mode Midtrans: QR + countdown |
| `11-bayar-otomatis-nominal-beda.png` | Nominal pembayaran beda |
| `12-bayar-otomatis-qr-kedaluwarsa.png` | QR habis |
| `13-bayar-lunas.png` | Pembayaran berhasil |
| `14-bayar-dibatalkan.png` | Pesanan batal |
| `15-bayar-tidak-ditemukan.png` | Link salah |
| `20-admin-login.png` | Login admin |
| `21-admin-bukan-admin.png` | Akun bukan admin |
| `22-admin-tab-pesanan.png` | Daftar pesanan (5 contoh, semua status) |
| `23-admin-tab-batch.png` | Kelola batch |
| `24-admin-tab-produk.png` | Harga & aktif/nonaktif |
| `25-admin-tab-ekspor.png` | Unduh CSV |
