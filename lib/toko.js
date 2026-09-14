// Info toko (sesuai poster). Dipakai katalog & halaman bayar.
export const KONTAK_WA = "0855-9119-1217";

// Satu-satunya titik antar pesanan
export const LOKASI_ANTAR = "Capital Place";

// Kredit pembuat web di footer (portofolio)
export const DIBUAT_OLEH = { nama: "ramcode.site", url: "https://www.ramcode.site" };

export const waLink = (pesan) =>
  `https://wa.me/6285591191217${pesan ? `?text=${encodeURIComponent(pesan)}` : ""}`;

// Link chat ke nomor pembeli (08xx → 628xx). Dipakai halaman admin.
export const waPembeli = (phone, pesan) => {
  const nomor = String(phone || "").replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${nomor}${pesan ? `?text=${encodeURIComponent(pesan)}` : ""}`;
};
