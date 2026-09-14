// Potongan tampilan yang dipakai bareng halaman pembeli:
// logo, hiasan, langkah "Cara Pesan", stepper qty, header halaman, footer WA.
import { Fragment } from "react";
import Link from "next/link";
import { DIBUAT_OLEH, KONTAK_WA, LOKASI_ANTAR, waLink } from "../lib/toko";
import {
  IkonAkun,
  IkonCentang,
  IkonChevronKanan,
  IkonKeranjang,
  IkonMinus,
  IkonPanahKiri,
  IkonPin,
  IkonPlus,
  IkonQr,
  IkonWhatsApp,
} from "./Ikon";

// Baris info titik antar, dipakai di kotak total keranjang & ringkasan bayar.
export function InfoAntar() {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-brand-50 px-3 py-2 text-xs text-coklat-700">
      <IkonPin className="h-4 w-4 shrink-0 text-brand-600" />
      <span>
        Khusus diantar ke <b className="text-coklat-900">{LOKASI_ANTAR}</b>
      </span>
    </p>
  );
}

// Keranjang berisi keripik. Sama dengan app/icon.svg (favicon).
export function Logo({ className = "h-14 w-14" }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <g stroke="#3a1d0e" strokeWidth="2" strokeLinejoin="round">
        <ellipse cx="21" cy="22" rx="9" ry="8" fill="#fbbf24" transform="rotate(-20 21 22)" />
        <ellipse cx="42" cy="21" rx="9" ry="8" fill="#fcd34d" transform="rotate(18 42 21)" />
        <ellipse cx="31.5" cy="15" rx="10" ry="9" fill="#f59e0b" />
      </g>
      <g fill="#b45309">
        <circle cx="29" cy="13" r="1.2" />
        <circle cx="34.5" cy="17" r="1" />
        <circle cx="19" cy="21" r="1" />
        <circle cx="44" cy="19" r="1" />
      </g>
      <path
        d="M9 30h46l-5.5 22a5 5 0 0 1-4.85 3.8H19.35A5 5 0 0 1 14.5 52Z"
        fill="#ea580c"
        stroke="#3a1d0e"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M13 38.5h38M15 46h34" stroke="#fdba74" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 31v23M32 31v24M40 31v23" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" />
      <rect x="6" y="26" width="52" height="7" rx="3.5" fill="#f97316" stroke="#3a1d0e" strokeWidth="2.2" />
    </svg>
  );
}

// Tiga garis "cring" di dekat logo & foto.
export function Percik({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 15l5 2" />
      <path d="M6 5l4 6" />
      <path d="M15 3v7" />
    </svg>
  );
}

// Daun hiasan di pojok bawah.
export function Daun({ className = "" }) {
  return (
    <svg viewBox="0 0 80 100" fill="currentColor" aria-hidden="true" className={className}>
      <ellipse cx="22" cy="78" rx="9" ry="30" transform="rotate(-28 22 78)" />
      <ellipse cx="48" cy="88" rx="7" ry="22" transform="rotate(22 48 88)" />
      <ellipse cx="8" cy="50" rx="5" ry="16" transform="rotate(-58 8 50)" />
    </svg>
  );
}

// Stiker merah bergerigi seperti stempel harga di poster.
const GERIGI = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 ? 43 : 50;
  const a = (Math.PI * 2 * i) / 28;
  return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

// Posisi (absolute/relative) diatur pemanggil lewat className.
export function Stempel({ children, className = "relative" }) {
  return (
    <div className={`grid place-items-center ${className}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 h-full w-full drop-shadow-md">
        <polygon points={GERIGI} fill="#dc2626" />
      </svg>
      <span className="relative text-center font-display text-[13px] uppercase leading-[1.05] tracking-wide text-white">
        {children}
      </span>
    </div>
  );
}

// Pembeli masuk Google dulu, pesan, lalu bayar QRIS kapan saja (upload bukti, dicek admin).
const LANGKAH = [
  [IkonKeranjang, "Pilih", "camilan"],
  [IkonAkun, "Masuk", "& pesan"],
  [IkonQr, "Bayar", "nanti"],
];

// `aktif` (1–4) dipakai di halaman bayar buat menandai posisi pembeli; 4 = semua langkah beres.
export function CaraPesan({ aktif, judul = "Cara Pesan", className = "" }) {
  return (
    <section className={`kartu px-4 py-4 ${className}`}>
      {judul && <h2 className="mb-3 text-lg font-extrabold">{judul}</h2>}
      <ol className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center">
        {LANGKAH.map(([Ikon, baris1, baris2], i) => {
          const no = i + 1;
          const lewat = aktif && no < aktif;
          const kini = aktif === no;
          const nanti = aktif && no > aktif;
          return (
            <Fragment key={no}>
              {i > 0 && (
                <li role="presentation" className="px-1 text-brand-400">
                  <IkonChevronKanan className="h-4 w-4" strokeWidth={2.5} />
                </li>
              )}
              <li
                aria-current={kini ? "step" : undefined}
                className={`flex items-start justify-center gap-2 ${nanti ? "opacity-50" : ""}`}
              >
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white ${
                    lewat ? "bg-green-600" : "bg-gradient-to-b from-brand-500 to-brand-600"
                  } ${kini ? "ring-4 ring-brand-200" : ""}`}
                >
                  {lewat ? <IkonCentang className="h-4 w-4" strokeWidth={3} /> : no}
                </span>
                <span className="flex flex-col gap-1">
                  <Ikon className="h-6 w-6 text-coklat-900" strokeWidth={1.8} />
                  <span className="text-[13px] font-semibold leading-tight">
                    {baris1}
                    <br />
                    {baris2}
                  </span>
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

export function Stepper({ qty, nama, onKurang, onTambah, kecil = false }) {
  const tombol = kecil ? "h-8 w-8" : "h-9 w-9";
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-full bg-brand-100 p-1 ${
        kecil ? "" : "h-11 w-full"
      }`}
    >
      <button
        type="button"
        onClick={onKurang}
        aria-label={`Kurangi ${nama}`}
        className={`grid ${tombol} place-items-center rounded-full bg-white text-brand-600 shadow-sm transition active:scale-90`}
      >
        <IkonMinus className="h-4 w-4" strokeWidth={2.8} />
      </button>
      <span className="min-w-[1.5rem] text-center font-extrabold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        onClick={onTambah}
        aria-label={`Tambah ${nama}`}
        className={`grid ${tombol} place-items-center rounded-full bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm transition active:scale-90`}
      >
        <IkonPlus className="h-4 w-4" strokeWidth={2.8} />
      </button>
    </div>
  );
}

// Header halaman dalam: tombol kembali (kalau ada `kembali`) atau logo kecil.
export function HeaderHalaman({ judul, sub, kembali }) {
  return (
    <header className="flex items-center gap-3 px-4 pt-5">
      {kembali ? (
        <Link
          href={kembali}
          aria-label="Kembali"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-brand-100 bg-white shadow-sm transition active:scale-95"
        >
          <IkonPanahKiri />
        </Link>
      ) : (
        <Link href="/" aria-label="Ke katalog" className="shrink-0">
          <Logo className="h-11 w-11" />
        </Link>
      )}
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold leading-tight">{judul}</h1>
        {sub && <p className="truncate text-sm text-stone-500">{sub}</p>}
      </div>
    </header>
  );
}

// Footer halaman pembeli: kontak WA + kredit pembuat web. `privasi` = tampilkan tautan Kebijakan Privasi.
export function FooterWa({ teks, pesan, privasi = false, className = "" }) {
  return (
    <div className={className}>
    <p className="flex items-center justify-center gap-1.5 px-4 text-center text-xs text-stone-500">
      <IkonWhatsApp className="h-4 w-4 shrink-0 text-[#25D366]" />
      <span>
        {teks}{" "}
        <a
          href={waLink(pesan)}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand-600 underline underline-offset-2"
        >
          {KONTAK_WA}
        </a>
      </span>
    </p>
    <p className="mt-2 px-4 text-center text-[11px] text-stone-400">
      {privasi && (
        <>
          <Link href="/privasi" className="underline underline-offset-2">
            Kebijakan Privasi
          </Link>
          <span aria-hidden="true"> · </span>
        </>
      )}
      Dibuat oleh{" "}
      <a
        href={DIBUAT_OLEH.url}
        target="_blank"
        rel="noopener"
        className="font-semibold text-coklat-700 underline underline-offset-2"
      >
        {DIBUAT_OLEH.nama}
      </a>
    </p>
    </div>
  );
}
