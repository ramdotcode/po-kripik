"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, rupiah } from "../../lib/supabase";
import { useCart } from "../../lib/cart";
import { fetchAuth, keluar, namaAkun, useSesi } from "../../lib/auth";
import TombolGoogle from "../../components/TombolGoogle";
import { FooterWa, HeaderHalaman, InfoAntar, Logo, Stepper } from "../../components/Brand";
import { IkonBulan, IkonKalender, IkonPanahKanan, IkonSampah, IkonSilang } from "../../components/Ikon";

export default function Keranjang() {
  const { list, setQty, totalQty, totalPrice, clear } = useCart();
  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState(undefined); // undefined = belum dicek
  const router = useRouter();
  const sesi = useSesi();

  // Isi otomatis dari akun Google & nomor WA yang terakhir dipakai di HP ini
  useEffect(() => {
    if (!sesi) return;
    setNama((n) => n || namaAkun(sesi.user));
    try {
      const w = localStorage.getItem("kripik-wa");
      if (w) setWa((x) => x || w);
    } catch {}
  }, [sesi]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("batches")
        .select("name, note")
        .eq("status", "buka")
        .maybeSingle();
      setBatch(data || null);
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (list.length === 0) return;
    setSaving(true);
    setError("");

    try {
      // Total dihitung ulang di server dari harga database,
      // jadi angka di layar ini murni buat ditampilkan.
      const res = await fetchAuth("/api/pesanan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: nama.trim(),
          phone: wa.trim(),
          notes: catatan.trim(),
          items: list.map((i) => ({ product_id: i.product.id, qty: i.qty })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(res.status === 401 ? "Sesi login habis, masuk lagi ya." : data?.error || "Gagal membuat pesanan.");
        setSaving(false);
        return;
      }

      try {
        localStorage.setItem("kripik-wa", wa.trim());
      } catch {}
      clear();
      router.push(`/bayar/${data.id}`);
    } catch {
      setError("Gagal menghubungi server. Cek koneksi internetmu.");
      setSaving(false);
    }
  };

  // Tandai kolom yang disebut pesan error server
  const kolomSalah = /WhatsApp/.test(error) ? "wa" : /Nama/.test(error) ? "nama" : null;
  const salah = (k) => (kolomSalah === k ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "");

  return (
    <main className="pb-10">
      <HeaderHalaman
        judul="Keranjang"
        sub={batch ? `Pesanan masuk ke ${batch.name}` : null}
        kembali="/"
      />

      {batch === null && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-3xl border border-stone-200 bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-600">
          <IkonBulan className="h-5 w-5 shrink-0" />
          PO lagi tutup, pesanan belum bisa dikirim.
        </div>
      )}

      {list.length === 0 ? (
        <div className="px-6 pt-14 text-center">
          <Logo className="mx-auto h-24 w-24" />
          <p className="mt-4 text-lg font-extrabold">Keranjang masih kosong</p>
          <p className="mt-1 text-sm text-stone-500">Yuk pilih camilan dulu, nanti balik lagi ke sini.</p>
          <Link href="/" className="btn-oranye mt-5 h-12 px-6">
            Pilih camilan <IkonPanahKanan className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3 px-4 pt-4">
            {list.map(({ product, qty }) => (
              <li key={product.id} className="kartu flex gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-sm font-semibold leading-snug">{product.name}</p>
                    <button
                      type="button"
                      onClick={() => setQty(product, 0)}
                      aria-label={`Hapus ${product.name}`}
                      className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <IkonSampah className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-stone-500">
                    {rupiah(product.price)}
                    {product.weight ? ` / ${product.weight}` : ""}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <Stepper
                      kecil
                      qty={qty}
                      nama={product.name}
                      onKurang={() => setQty(product, qty - 1)}
                      onTambah={() => setQty(product, qty + 1)}
                    />
                    <p className="font-extrabold tabular-nums text-brand-600">{rupiah(product.price * qty)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="kartu mx-4 mt-4 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-bold">Total</p>
                <p className="text-xs text-stone-500">{totalQty} item</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums text-brand-700">{rupiah(totalPrice)}</p>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Saat bayar ditambah kode unik 3 digit akunmu (maks Rp999) biar pembayaranmu gampang dicek.
            </p>
            <div className="mt-3 space-y-2">
              {batch?.note && (
                <p className="flex items-start gap-2 rounded-2xl bg-brand-50 px-3 py-2 text-xs text-coklat-700">
                  <IkonKalender className="h-4 w-4 shrink-0 text-brand-600" />
                  {batch.note}
                </p>
              )}
              <InfoAntar />
            </div>
          </div>

          {sesi === null ? (
            <div className="kartu mx-4 mt-4 p-5 text-center">
              <p className="text-lg font-extrabold">Masuk dulu buat pesan</p>
              <p className="mt-1 text-sm text-stone-500">
                Pesananmu tersimpan di akunmu — bisa bayar sekarang atau nanti, dan cek statusnya kapan saja.
              </p>
              <TombolGoogle kembaliKe="/keranjang" className="mt-4" />
              <p className="mt-2 text-xs text-stone-400">
                Tenang, isi keranjangmu nggak hilang. Dengan masuk, kamu setuju dengan {" "}
                <Link href="/privasi" className="underline underline-offset-2">Kebijakan Privasi</Link>.
              </p>
            </div>
          ) : sesi === undefined ? (
            <div className="kartu mx-4 mt-4 h-40 animate-pulse" />
          ) : (
          <form onSubmit={submit} className="kartu mx-4 mt-4 space-y-4 p-4">
            <div>
              <p className="font-extrabold">Data pemesan</p>
              <p className="text-xs text-stone-500">Dipakai kalau kami perlu menghubungimu soal pesanan.</p>
              <p className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-brand-50 px-3 py-2 text-xs text-coklat-700">
                <span className="truncate">
                  Masuk sebagai <b>{sesi.user.email}</b>
                </span>
                <button type="button" onClick={keluar} className="shrink-0 font-semibold text-brand-600 underline">
                  Ganti akun
                </button>
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="nama" className="text-sm font-semibold">
                Nama
              </label>
              <input
                id="nama"
                required
                autoComplete="name"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama kamu"
                aria-invalid={kolomSalah === "nama" || undefined}
                className={`input ${salah("nama")}`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wa" className="text-sm font-semibold">
                No. WhatsApp
              </label>
              <input
                id="wa"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                placeholder="08123456789"
                aria-invalid={kolomSalah === "wa" || undefined}
                className={`input ${salah("wa")}`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="catatan" className="text-sm font-semibold">
                Catatan <span className="font-normal text-stone-400">(opsional)</span>
              </label>
              <textarea
                id="catatan"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Mis. titip buat tetangga, atau pesan lain"
                rows={2}
                className="input resize-none"
              />
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <IkonSilang className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <button disabled={saving || batch === null} className="btn-oranye h-14 w-full text-base">
              {saving ? (
                "Menyimpan…"
              ) : (
                <>
                  Buat Pesanan · {rupiah(totalPrice)}
                  <IkonPanahKanan className="h-5 w-5" strokeWidth={2.5} />
                </>
              )}
            </button>
            <p className="text-center text-xs text-stone-500">
              Bayar sekarang atau nanti — pesananmu tersimpan di menu Pesanan Saya.
            </p>
          </form>
          )}
        </>
      )}

      <FooterWa className="pt-6" teks="Ada pertanyaan? WhatsApp" pesan="Halo, mau tanya soal PO kripik" />
    </main>
  );
}
