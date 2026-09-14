// Info toko (sesuai poster). Dipakai katalog & halaman bayar.
export const KONTAK_WA = "0855-9119-1217";

export const waLink = (pesan) =>
  `https://wa.me/6285591191217${pesan ? `?text=${encodeURIComponent(pesan)}` : ""}`;
