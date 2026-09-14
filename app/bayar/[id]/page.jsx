"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { rupiah, supabase } from "../../../lib/supabase";
import { fetchAuth, useSesi } from "../../../lib/auth";
import TombolGoogle from "../../../components/TombolGoogle";
import { KONTAK_WA } from "../../../lib/toko";
import { CaraPesan, FooterWa, HeaderHalaman, InfoAntar, Logo } from "../../../components/Brand";
import {
  IkonCentang,
  IkonJam,
  IkonKalender,
  IkonPanahKanan,
  IkonPanahKiri,
  IkonQr,
  IkonSalin,
  IkonSilang,
  IkonUnggah,
  IkonAkun,
  IkonChevronKanan,
} from "../../../components/Ikon";

const POLL_MS = 4000;

function Countdown({ until, onHabis }) {
  const hitung = () => new Date(until).getTime() - Date.now();
  const [sisa, setSisa] = useState(hitung);

  useEffect(() => {
    setSisa(hitung());
    const t = setInterval(() => {
      const s = hitung();
      setSisa(s);
      if (s <= 0) {
        clearInterval(t);
        onHabis();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [until]); // eslint-disable-line react-hooks/exhaustive-deps

  const detik = Math.max(0, Math.floor(sisa / 1000));
  const mm = String(Math.floor(detik / 60)).padStart(2, "0");
  const ss = String(detik % 60).padStart(2, "0");
  return (
    <span className="font-extrabold tabular-nums">
      {mm}:{ss}
    </span>
  );
}

function Selesai({ judul, pesan }) {
  return (
    <div className="kartu p-6 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-600 ring-8 ring-green-50">
        <IkonCentang className="h-8 w-8" strokeWidth={3} />
      </span>
      <p className="mt-4 text-xl font-extrabold">{judul}</p>
      <p className="mt-1 text-sm text-stone-600">{pesan}</p>
      <Link href="/" className="btn-lembut mt-5 h-11 px-5 text-sm">
        <IkonPanahKiri className="h-4 w-4" strokeWidth={2.5} />
        Kembali ke katalog
      </Link>
    </div>
  );
}

// Judul kartu bayar: label kecil + nominal besar
function Nominal({ label, jumlah }) {
  return (
    <>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="text-3xl font-extrabold tabular-nums text-brand-700">{rupiah(jumlah)}</p>
    </>
  );
}

// Link /bayar/[id] satu-satunya jalan balik ke pesanan, jadi ajak pembeli menyimpannya.
function SalinLink() {
  const [ok, setOk] = useState(false);
  const salin = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch {
      window.prompt("Salin link pesanan ini:", url);
    }
  };
  return (
    <div className="kartu mx-4 mt-4 flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Simpan link pesanan ini</p>
        <p className="text-xs text-stone-500">Buat cek status atau bayar lagi nanti.</p>
      </div>
      <button type="button" onClick={salin} className="btn-lembut h-10 shrink-0 px-4 text-sm">
        {ok ? <IkonCentang className="h-4 w-4" strokeWidth={2.6} /> : <IkonSalin className="h-4 w-4" />}
        {ok ? "Tersalin" : "Salin"}
      </button>
    </div>
  );
}

// Pesanan milik akun: jalan balik ke pesanan lewat menu Pesanan Saya, bukan simpan link.
function LinkPesananSaya() {
  return (
    <Link href="/pesanan" className="kartu mx-4 mt-4 flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-600">
        <IkonAkun className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Pesanan Saya</span>
        <span className="block text-xs text-stone-500">Semua pesananmu & status bayarnya ada di sini.</span>
      </span>
      <IkonChevronKanan className="h-5 w-5 shrink-0 text-brand-400" />
    </Link>
  );
}

export default function Bayar() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Jalur manual (QRIS statis + upload bukti)
  const [uploading, setUploading] = useState(false);
  // Jalur otomatis (QRIS dinamis Midtrans)
  const [qr, setQr] = useState(null); // sesi Snap: { pay_url, expiry_time, amount }
  const [qrLoading, setQrLoading] = useState(false);
  const [qrHabis, setQrHabis] = useState(false);

  const sesi = useSesi();
  const uid = sesi === undefined ? undefined : sesi?.user?.id || null;
  const [perluLogin, setPerluLogin] = useState(false);
  const [qrisUrl, setQrisUrl] = useState(undefined); // gambar QRIS statis dari admin

  // Pesanan milik akun cuma bisa dibuka pemiliknya -> tunggu status login dulu,
  // lalu ambil ulang kalau akunnya berubah (mis. baru balik dari login Google).
  useEffect(() => {
    if (uid === undefined) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchAuth(`/api/pesanan/${id}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setPerluLogin(res.status === 401);
        if (res.ok) {
          setOrder(data.order);
          setItems(data.items || []);
        } else setOrder(null);
      } catch {}
      setLoading(false);
    })();
  }, [id, uid]);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "qris_url")
      .maybeSingle()
      .then(({ data }) => setQrisUrl(data?.value || null));
  }, []);

  const tandaiLunas = () => setOrder((o) => ({ ...o, sudah_bayar: true }));

  const bikinQr = useCallback(async () => {
    setQrLoading(true);
    setQrHabis(false);
    setError("");
    try {
      const res = await fetch(`/api/pesanan/${id}/qris`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data?.error || "Gagal membuat QRIS.");
      else if (data.paid) tandaiLunas();
      else setQr(data);
    } catch {
      setError("Gagal menghubungi server. Cek koneksi internetmu.");
    }
    setQrLoading(false);
  }, [id]);

  const perluQr =
    !!order && order.bayar_otomatis && !order.sudah_bayar && order.status !== "batal";

  // Buka halaman -> langsung siapkan sesi bayar (server mengembalikan sesi lama kalau masih aktif)
  useEffect(() => {
    if (perluQr && !qr) bikinQr();
  }, [perluQr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cek status berkala. Server yang tanya ke Midtrans, jadi tetap jalan walau webhook telat.
  useEffect(() => {
    if (!qr || qrHabis || order?.sudah_bayar) return;
    let berhenti = false;
    const cek = async () => {
      try {
        const res = await fetch(`/api/pesanan/${id}/qris`, { cache: "no-store" });
        const data = await res.json();
        if (berhenti || !res.ok) return;
        if (data.paid) tandaiLunas();
        else if (data.status === "nominal_beda")
          setError(`Pembayaran masuk tapi nominalnya beda. Hubungi penjual via WhatsApp ${KONTAK_WA} ya.`);
        else if (["expire", "cancel", "deny", "failure"].includes(data.status)) setQrHabis(true);
      } catch {}
    };
    cek(); // langsung, biar yang baru balik dari Midtrans nggak nunggu 4 detik
    const t = setInterval(cek, POLL_MS);
    return () => {
      berhenti = true;
      clearInterval(t);
    };
  }, [qr, qrHabis, order?.sudah_bayar, id]);

  const uploadProof = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetchAuth(`/api/pesanan/${id}/bukti`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) setError(data?.error || "Gagal upload bukti.");
      else setOrder((o) => ({ ...o, sudah_upload: true, status: data.status, bukti_ditolak: null }));
    } catch {
      setError("Gagal upload. Cek koneksi internetmu.");
    }
    setUploading(false);
    e.target.value = ""; // biar file yang sama bisa dipilih ulang kalau gagal
  };

  if (loading)
    return (
      <main className="space-y-4 px-4 pt-5" aria-busy="true">
        <div className="h-12 w-48 animate-pulse rounded-2xl bg-brand-100" />
        <div className="h-24 animate-pulse rounded-3xl bg-brand-100/80" />
        <div className="h-72 animate-pulse rounded-3xl bg-brand-100/80" />
      </main>
    );

  if (!order && perluLogin)
    return (
      <main className="px-6 pt-20 text-center">
        <Logo className="mx-auto h-20 w-20" />
        <p className="mt-4 text-lg font-extrabold">Masuk dulu ya</p>
        <p className="mt-1 text-sm text-stone-500">
          Pesanan ini tersimpan di akun Google yang dipakai waktu memesan.
        </p>
        <TombolGoogle kembaliKe={`/bayar/${id}`} className="mt-5" />
        <FooterWa className="pt-8" teks="Butuh bantuan? WhatsApp" pesan="Halo, aku nggak bisa buka pesananku" />
      </main>
    );

  if (!order)
    return (
      <main className="px-6 pt-20 text-center">
        <Logo className="mx-auto h-20 w-20 grayscale" />
        <p className="mt-4 text-lg font-extrabold">Pesanan tidak ditemukan</p>
        <p className="mt-1 text-sm text-stone-500">Cek lagi link-nya, atau pastikan kamu masuk dengan akun yang dipakai waktu memesan.</p>
        <Link href="/" className="btn-oranye mt-5 h-12 px-6">
          <IkonPanahKiri className="h-4 w-4" strokeWidth={2.5} />
          Kembali ke katalog
        </Link>
        <FooterWa className="pt-8" teks="Butuh bantuan? WhatsApp" pesan="Halo, link pesananku nggak bisa dibuka" />
      </main>
    );

  const kode = String(order.id).slice(0, 8);
  const batal = order.status === "batal";
  const sapaan = order.sudah_bayar
    ? "pembayaranmu sudah kami terima."
    : batal
    ? "pesanan ini sudah dibatalkan."
    : order.sudah_upload && !order.bayar_otomatis
    ? "buktimu lagi kami cek."
    : order.bukti_ditolak
    ? "buktimu belum bisa kami terima, cek alasannya di bawah ya."
    : order.bayar_otomatis
    ? "tinggal bayar pakai QRIS ya."
    : "pesananmu sudah tercatat. Bayar sekarang atau nanti, bebas.";

  let bagianBayar;
  if (order.sudah_bayar) {
    bagianBayar = (
      <Selesai judul="Pembayaran berhasil! 🎉" pesan="Pesananmu sudah lunas, tinggal tunggu diantar ya." />
    );
  } else if (batal) {
    bagianBayar = (
      <div className="rounded-3xl border border-stone-200 bg-stone-100 p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-stone-200 text-stone-500">
          <IkonSilang className="h-7 w-7" />
        </span>
        <p className="mt-3 font-extrabold">Pesanan ini sudah dibatalkan</p>
        <p className="mt-1 text-sm text-stone-500">Ada pertanyaan? Chat kami di WhatsApp.</p>
      </div>
    );
  } else if (order.bayar_otomatis) {
    // ---------- QRIS lewat Midtrans Snap ----------
    bagianBayar = (
      <>
        {qrHabis ? (
          <div className="kartu p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-600">
              <IkonJam className="h-7 w-7" />
            </span>
            <p className="mt-3 text-lg font-extrabold">QR sudah kedaluwarsa</p>
            <p className="mt-1 text-sm text-stone-500">Belum sempat bayar? Bikin QR baru aja.</p>
            <button onClick={bikinQr} disabled={qrLoading} className="btn-oranye mt-5 h-12 w-full">
              {qrLoading ? "Menyiapkan…" : "Bikin QR Baru"}
            </button>
          </div>
        ) : qr ? (
          <>
            <div className="kartu p-5 text-center">
              <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-600">
                <IkonQr className="h-7 w-7" strokeWidth={1.8} />
              </span>
              <Nominal label="Bayar pakai QRIS" jumlah={qr.amount} />
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                <IkonJam className="h-3.5 w-3.5" strokeWidth={2.4} />
                Selesaikan dalam <Countdown until={qr.expiry_time} onHabis={() => setQrHabis(true)} />
              </p>
              <a href={qr.pay_url} className="btn-oranye mt-5 h-14 w-full text-base">
                Bayar dengan QRIS
                <IkonPanahKanan className="h-5 w-5" strokeWidth={2.5} />
              </a>
              <p className="mt-3 text-xs leading-relaxed text-stone-500">
                Kamu dibawa ke halaman pembayaran Midtrans. QR-nya bisa di-scan dari HP lain atau diunduh lalu
                di-upload dari aplikasi e-wallet / m-banking. Setelah bayar, kamu balik ke sini otomatis.
              </p>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75 motion-reduce:hidden" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              Menunggu pembayaran… halaman ini otomatis berubah begitu uang masuk
            </div>
          </>
        ) : (
          !error && (
            <div className="kartu flex h-72 animate-pulse items-center justify-center text-sm text-stone-500">
              Menyiapkan QRIS…
            </div>
          )
        )}

        {error && (
          <div role="alert" className="mt-3 rounded-2xl bg-red-50 p-4 text-center">
            <p className="text-sm text-red-700">{error}</p>
            {!qr && (
              <button
                onClick={bikinQr}
                disabled={qrLoading}
                className="mt-3 font-semibold text-brand-600 underline disabled:opacity-50"
              >
                Coba lagi
              </button>
            )}
          </div>
        )}
      </>
    );
  } else if (order.sudah_upload) {
    // Bukti sudah dikirim, tinggal nunggu admin ACC / tolak
    bagianBayar = (
      <div className="kartu p-6 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-700 ring-8 ring-amber-50">
          <IkonJam className="h-8 w-8" />
        </span>
        <p className="mt-4 text-xl font-extrabold">Bukti lagi dicek admin</p>
        <p className="mt-1 text-sm text-stone-600">
          Kalau sudah di-ACC, status pesananmu jadi <b>Sudah bayar</b>. Cek statusnya kapan saja di Pesanan Saya.
        </p>
        <label
          aria-disabled={uploading || undefined}
          className={`btn-lembut mt-5 h-11 cursor-pointer px-5 text-sm ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <IkonUnggah className="h-4 w-4" />
          {uploading ? "Mengupload…" : "Ganti foto bukti"}
          <input type="file" accept="image/*" onChange={uploadProof} disabled={uploading} className="hidden" />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  } else {
    // ---------- QRIS statis dari admin + upload bukti (admin ACC / tolak) ----------
    bagianBayar = (
      <>
        {order.bukti_ditolak && (
          <div role="alert" className="mb-3 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <IkonSilang className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>Bukti sebelumnya ditolak:</b> {order.bukti_ditolak}. Cek lagi lalu upload ulang ya.
            </span>
          </div>
        )}
        <div className="kartu p-5 text-center">
          <Nominal label="Scan QRIS di bawah & bayar" jumlah={order.total_bayar ?? order.total} />
          <div className="mx-auto mt-4 w-full max-w-xs rounded-3xl border-2 border-dashed border-brand-200 bg-white p-3">
            {qrisUrl === undefined ? (
              <div className="aspect-square w-full animate-pulse rounded-2xl bg-brand-100" />
            ) : qrisUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrisUrl} alt="QRIS toko" className="w-full rounded-2xl" />
            ) : (
              <p className="px-3 py-10 text-sm text-stone-500">
                QRIS belum dipasang admin. Tanya kami lewat WhatsApp ya.
              </p>
            )}
          </div>
          {order.kode_unik ? (
            <p className="mt-3 rounded-2xl bg-brand-50 px-3 py-2 text-xs text-coklat-700">
              Transfer <b>persis</b> sampai 3 digit terakhir.{" "}
              <b className="font-mono">{String(order.kode_unik).padStart(3, "0")}</b> itu kode unik akunmu, biar
              pembayaranmu gampang dicek admin. Nominalnya ikut jadi bagian pembayaran, tidak dikembalikan.
            </p>
          ) : (
            <p className="mt-3 text-xs text-stone-500">Pastikan nominalnya pas sampai rupiah terakhir ya.</p>
          )}
        </div>

        <label
          aria-disabled={uploading || undefined}
          className={`btn-oranye mt-3 h-14 w-full cursor-pointer text-base ${
            uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <IkonUnggah className="h-5 w-5" strokeWidth={2.4} />
          {uploading ? "Mengupload…" : "Sudah Bayar? Upload Bukti"}
          <input type="file" accept="image/*" onChange={uploadProof} disabled={uploading} className="hidden" />
        </label>
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <IkonSilang className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        <p className="mt-2 text-center text-xs text-stone-500">
          Screenshot bukti dari aplikasi pembayaranmu (maks 5 MB). Admin cek dulu sebelum pesananmu diproses.
        </p>
        {order.milik_akun && (
          <Link href="/pesanan" className="btn-lembut mt-3 h-12 w-full text-sm">
            Bayar nanti aja
          </Link>
        )}
      </>
    );
  }

  return (
    <main className="pb-10">
      <HeaderHalaman
        judul="Pembayaran"
        sub={`Pesanan #${kode}${order.batch_name ? ` · ${order.batch_name}` : ""}`}
      />

      <p className="px-4 pt-4 text-[15px] text-coklat-700">
        Hai <b className="text-coklat-900">{order.customer_name}</b>, {sapaan}
      </p>

      {!batal && <CaraPesan judul={null} aktif={order.sudah_bayar ? 4 : 3} className="mx-4 mt-3" />}

      <div className="mx-4 mt-4">{bagianBayar}</div>

      <div className="kartu mx-4 mt-4 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Ringkasan pesanan</p>
        <ul className="mt-1 divide-y divide-brand-100">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3 py-2 text-sm">
              <span>
                {it.product_name} <span className="text-stone-400">× {it.qty}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{rupiah(it.price * it.qty)}</span>
            </li>
          ))}
        </ul>
        {order.kode_unik ? (
          <div className="mt-1 space-y-1 border-t border-dashed border-brand-200 pt-3">
            <p className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold tabular-nums">{rupiah(order.total)}</span>
            </p>
            <p className="flex justify-between text-sm text-stone-500">
              <span>Kode unik akunmu</span>
              <span className="tabular-nums">+{rupiah(order.kode_unik)}</span>
            </p>
            <p className="flex items-center justify-between pt-1">
              <span className="font-bold">Total bayar</span>
              <span className="text-xl font-extrabold tabular-nums text-brand-700">{rupiah(order.total_bayar)}</span>
            </p>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between border-t border-dashed border-brand-200 pt-3">
            <span className="font-bold">Total</span>
            <span className="text-xl font-extrabold tabular-nums text-brand-700">{rupiah(order.total)}</span>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {order.batch_note && (
            <p className="flex items-start gap-2 rounded-2xl bg-brand-50 px-3 py-2 text-xs text-coklat-700">
              <IkonKalender className="h-4 w-4 shrink-0 text-brand-600" />
              {order.batch_note}
            </p>
          )}
          <InfoAntar />
        </div>
      </div>

      {order.milik_akun ? <LinkPesananSaya /> : <SalinLink />}

      <FooterWa className="pt-6" teks="Ada kendala pembayaran? WhatsApp" pesan={`Halo, soal pesanan #${kode}`} />
    </main>
  );
}
