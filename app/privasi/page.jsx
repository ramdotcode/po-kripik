import Link from "next/link";
import { FooterWa, HeaderHalaman } from "../../components/Brand";
import { KONTAK_WA, LOKASI_ANTAR, waLink } from "../../lib/toko";

export const metadata = {
  title: "Kebijakan Privasi · PO Kripik",
  description: "Data apa yang dikumpulkan PO Kripik, untuk apa, dan bagaimana kami menjaganya.",
};

const BERLAKU = "14 September 2026";

function Bagian({ judul, children }) {
  return (
    <section className="kartu p-4">
      <h2 className="text-base font-extrabold">{judul}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-coklat-700">{children}</div>
    </section>
  );
}

// Wajib ada untuk mempublikasikan aplikasi login Google (OAuth consent screen).
export default function Privasi() {
  return (
    <main className="pb-10">
      <HeaderHalaman judul="Kebijakan Privasi" sub={`Berlaku sejak ${BERLAKU}`} kembali="/" />

      <div className="space-y-3 px-4 pt-4">
        <Bagian judul="Siapa kami">
          <p>
            PO Kripik adalah usaha pre-order camilan rumahan yang diantar khusus ke {LOKASI_ANTAR}. Halaman ini
            menjelaskan data apa yang kami kumpulkan saat kamu memakai kripik.ramcode.site, untuk apa, dan bagaimana
            kami menjaganya.
          </p>
        </Bagian>

        <Bagian judul="Data yang kami kumpulkan">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Dari akun Google</b> saat kamu masuk: nama, alamat email, dan foto profil. Kami tidak meminta akses
              ke Gmail, Drive, kontak, atau data Google lainnya.
            </li>
            <li>
              <b>Data pesanan</b>: nama, nomor WhatsApp, catatan, produk yang dipesan, total, dan waktu pemesanan.
            </li>
            <li>
              <b>Foto bukti pembayaran</b> yang kamu upload.
            </li>
            <li>
              <b>Data di perangkatmu</b>: isi keranjang dan sesi login disimpan di browser (localStorage) supaya
              keranjang tidak hilang dan kamu tetap masuk. Kami tidak memakai iklan atau pelacak pihak ketiga.
            </li>
          </ul>
        </Bagian>

        <Bagian judul="Untuk apa datanya dipakai">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Mencatat, memproses, dan mengantar pesananmu.</li>
            <li>Menghubungimu lewat WhatsApp kalau ada kendala soal pesanan atau pembayaran.</li>
            <li>Mengecek bukti pembayaran sebelum pesanan diproses.</li>
            <li>Menampilkan riwayat pesananmu di menu Pesanan Saya.</li>
          </ul>
          <p>
            Data yang kami terima dari Google API dipakai sesuai{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-600 underline underline-offset-2"
            >
              Google API Services User Data Policy
            </a>
            , termasuk ketentuan Limited Use — hanya untuk login dan pesananmu, tidak untuk hal lain.
          </p>
        </Bagian>

        <Bagian judul="Dengan siapa data dibagikan">
          <p>
            Kami <b>tidak menjual</b> dan tidak membagikan datamu untuk iklan. Data hanya diproses oleh penyedia
            layanan yang kami pakai untuk menjalankan web ini:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Supabase — database, login, dan penyimpanan foto bukti pembayaran.</li>
            <li>Vercel — hosting website.</li>
            <li>Google — layanan login.</li>
          </ul>
        </Bagian>

        <Bagian judul="Penyimpanan & keamanan">
          <p>
            Data disimpan di server Supabase (region Sydney, Australia). Akses dibatasi: kamu hanya bisa melihat
            pesananmu sendiri, dan foto bukti pembayaran hanya bisa dibuka admin kami.
          </p>
          <p>
            Data pesanan kami simpan selama masih diperlukan untuk pencatatan penjualan. Kamu bisa minta datamu
            dihapus kapan saja.
          </p>
        </Bagian>

        <Bagian judul="Hak kamu">
          <p>
            Kamu bisa minta melihat, membetulkan, atau menghapus data dan akunmu dengan menghubungi kami lewat
            WhatsApp{" "}
            <a
              href={waLink("Halo, aku mau tanya/hapus data akunku di PO Kripik")}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-600 underline underline-offset-2"
            >
              {KONTAK_WA}
            </a>
            . Kamu juga bisa keluar dari akun kapan saja lewat menu Pesanan Saya, atau mencabut akses PO Kripik dari
            pengaturan akun Google-mu.
          </p>
        </Bagian>

        <Bagian judul="Perubahan kebijakan">
          <p>
            Kalau kebijakan ini berubah, versi terbarunya kami pasang di halaman ini dengan tanggal berlaku yang
            baru.
          </p>
        </Bagian>

        <p className="pt-1 text-center text-sm">
          <Link href="/" className="font-semibold text-brand-600 underline underline-offset-2">
            Kembali ke katalog
          </Link>
        </p>
      </div>

      <FooterWa className="pt-6" teks="Ada pertanyaan soal privasi? WhatsApp" pesan="Halo, mau tanya soal privasi data" />
    </main>
  );
}
