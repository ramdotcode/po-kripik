"use client";

import { useEffect, useState } from "react";
import { supabase, rupiah } from "../../lib/supabase";
import { IkonCentang, IkonGambar, IkonPlus, IkonSampah, IkonSilang, IkonTutup } from "../Ikon";

// Urutan sama dengan katalog: urutan poster dulu, sisanya abjad
const posisi = (p) => p.sort_order ?? Number.MAX_SAFE_INTEGER;
const urutkan = (ps) => ps.slice().sort((a, b) => posisi(a) - posisi(b) || a.name.localeCompare(b.name, "id"));

const LABEL = [
  [null, "Tanpa label"],
  ["FAVORIT", "★ Favorit"],
  ["BARU", "★ Baru"],
];
const SISI_MAKS = 800; // px — foto katalog tampil kecil, 800 sudah tajam di HP
const HARGA_MAKS = 10_000_000;

// Foto dari HP bisa belasan MB: kecilkan dulu di browser jadi JPG sebelum upload.
async function kecilkanFoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, gagal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = gagal;
      i.src = url;
    });
    const skala = Math.min(1, SISI_MAKS / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * skala);
    c.height = Math.round(img.naturalHeight * skala);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; // PNG transparan jangan jadi hitam
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
    if (!blob) throw new Error("toBlob");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Foto menu masuk bucket publik 'toko' (sama dengan QRIS), nama unik tiap upload
async function unggahFoto(blob) {
  const path = `produk/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("toko").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Gagal upload foto: " + error.message);
  return supabase.storage.from("toko").getPublicUrl(path).data.publicUrl;
}

// Tulis ulang sort_order 1..n sesuai urutan array; cuma baris yang berubah yang dikirim.
async function simpanUrutan(list) {
  const berubah = list.map((p, i) => [p, i + 1]).filter(([p, n]) => p.sort_order !== n);
  const hasil = await Promise.all(
    berubah.map(([p, n]) => supabase.from("products").update({ sort_order: n }).eq("id", p.id))
  );
  const gagal = hasil.find((r) => r.error);
  if (gagal) throw new Error("Gagal menyimpan urutan: " + gagal.error.message);
  return list.map((p, i) => ({ ...p, sort_order: i + 1 }));
}

function FormMenu({ produk, daftar, onTutup, onSimpan, onHapus }) {
  const lain = daftar.filter((p) => p.id !== produk?.id);
  const [nama, setNama] = useState(produk?.name ?? "");
  const [harga, setHarga] = useState(produk ? String(produk.price) : "");
  const [berat, setBerat] = useState(produk?.weight ?? "");
  const [label, setLabel] = useState(produk?.badge ?? null);
  // Menu baru default ditaruh setelah menu terakhir yang punya urutan (sebelum yang tanpa urutan)
  const [urutan, setUrutan] = useState(() =>
    produk ? daftar.findIndex((p) => p.id === produk.id) : lain.filter((p) => p.sort_order != null).length
  );
  const [aktif, setAktif] = useState(true);
  const [foto, setFoto] = useState(null); // { blob, preview } — foto baru yang belum diupload
  const [siapkanFoto, setSiapkanFoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => () => foto && URL.revokeObjectURL(foto.preview), [foto]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && !busy && onTutup();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busy, onTutup]);

  const pilihFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // biar file yang sama bisa dipilih ulang
    if (!file) return;
    setSiapkanFoto(true);
    setErr("");
    try {
      const blob = await kecilkanFoto(file);
      setFoto({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setErr("Foto nggak bisa dibaca. Coba pakai JPG atau PNG.");
    }
    setSiapkanFoto(false);
  };

  const nilaiHarga = Math.floor(Number(harga));

  const simpan = async (e) => {
    e.preventDefault();
    const n = nama.trim().replace(/\s+/g, " ");
    if (n.length < 2) return setErr("Nama menu minimal 2 huruf.");
    if (lain.some((p) => p.name.toLowerCase() === n.toLowerCase())) return setErr("Sudah ada menu dengan nama itu.");
    if (!Number.isFinite(nilaiHarga) || nilaiHarga < 500) return setErr("Harga minimal Rp 500.");
    if (nilaiHarga > HARGA_MAKS) return setErr("Harganya kebesaran, cek lagi ya.");
    if (!produk && !foto) return setErr("Pilih foto menunya dulu.");

    setBusy(true);
    setErr("");
    try {
      const data = {
        name: n,
        price: nilaiHarga,
        weight: berat.trim().replace(/\s+/g, "") || null,
        badge: label,
        image_url: foto ? await unggahFoto(foto.blob) : produk.image_url,
      };
      const { data: baris, error } = produk
        ? await supabase.from("products").update(data).eq("id", produk.id).select().single()
        : await supabase
            .from("products")
            .insert({ ...data, active: aktif })
            .select()
            .single();
      if (error) throw new Error("Gagal menyimpan: " + error.message);

      const baru = lain.slice();
      baru.splice(urutan, 0, baris);
      await onSimpan(baru, produk ? `"${n}" tersimpan` : `"${n}" ditambahkan`);
    } catch (e2) {
      setErr(e2.message || String(e2));
      setBusy(false);
    }
  };

  const hapus = async () => {
    if (
      !confirm(
        `Hapus "${produk.name}" dari menu?\n\nRiwayat pesanan yang sudah ada tetap aman. ` +
          `Kalau cuma mau disembunyikan sementara, pakai saklar Aktif/Nonaktif saja.`
      )
    )
      return;
    setBusy(true);
    setErr("");
    try {
      await onHapus(produk);
    } catch (e2) {
      setErr(e2.message || String(e2));
      setBusy(false);
    }
  };

  const gambar = foto?.preview || produk?.image_url;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={produk ? `Ubah ${produk.name}` : "Tambah menu"}
      onClick={() => !busy && onTutup()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-coklat-900/60 p-3 sm:items-center"
    >
      <form
        onSubmit={simpan}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-extrabold">{produk ? "Ubah menu" : "Tambah menu"}</p>
          <button
            type="button"
            onClick={onTutup}
            disabled={busy}
            aria-label="Tutup"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50"
          >
            <IkonTutup className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50">
            {gambar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gambar} alt="" className="h-full w-full object-cover" />
            ) : (
              <IkonGambar className="h-8 w-8 text-brand-300" />
            )}
          </div>
          <div className="min-w-0">
            <label
              aria-disabled={busy || siapkanFoto || undefined}
              className={`btn-lembut h-11 cursor-pointer px-4 text-sm ${busy || siapkanFoto ? "pointer-events-none opacity-60" : ""}`}
            >
              <IkonGambar className="h-4 w-4" />
              {siapkanFoto ? "Menyiapkan…" : gambar ? "Ganti foto" : "Pilih foto"}
              <input type="file" accept="image/*" onChange={pilihFoto} disabled={busy} className="hidden" />
            </label>
            <p className="mt-1.5 text-xs text-stone-500">Foto otomatis dikecilkan. Paling bagus yang kotak.</p>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold">Nama menu</span>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={120}
            placeholder="mis. Keripik Singkong Balado"
            className="input"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Harga</span>
            <span className="relative block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">
                Rp
              </span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="500"
                value={harga}
                onChange={(e) => setHarga(e.target.value)}
                placeholder="25000"
                className="input pl-11 tabular-nums"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">
              Berat <span className="font-normal text-stone-400">(opsional)</span>
            </span>
            <input
              value={berat}
              onChange={(e) => setBerat(e.target.value)}
              maxLength={20}
              placeholder="250gr"
              className="input"
            />
          </label>
        </div>
        {nilaiHarga >= 500 && <p className="mt-1 text-xs text-stone-500">Tampil di katalog: {rupiah(nilaiHarga)}</p>}

        <fieldset className="mt-3">
          <legend className="mb-1 text-sm font-semibold">Label</legend>
          <div className="flex flex-wrap gap-2">
            {LABEL.map(([nilai, teks]) => (
              <button
                key={teks}
                type="button"
                aria-pressed={label === nilai}
                onClick={() => setLabel(nilai)}
                className={`h-10 rounded-full px-4 text-sm font-bold transition ${
                  label === nilai
                    ? nilai
                      ? "bg-red-500 text-white"
                      : "bg-coklat-900 text-white"
                    : "border border-brand-100 bg-white text-coklat-700"
                }`}
              >
                {teks}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">Urutan di katalog</span>
          <select value={urutan} onChange={(e) => setUrutan(Number(e.target.value))} className="input">
            {Array.from({ length: lain.length + 1 }, (_, i) => (
              <option key={i} value={i}>
                Ke-{i + 1}
                {i === 0
                  ? " (paling atas)"
                  : i === lain.length
                    ? " (paling bawah)"
                    : ` — sebelum ${lain[i].name}${lain[i].active ? "" : " (nonaktif)"}`}
              </option>
            ))}
          </select>
        </label>

        {!produk && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aktif}
              onChange={(e) => setAktif(e.target.checked)}
              className="h-5 w-5 accent-brand-600"
            />
            Langsung tampil di katalog
          </label>
        )}

        {err && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <IkonSilang className="mt-0.5 h-4 w-4 shrink-0" />
            {err}
          </p>
        )}

        <button type="submit" disabled={busy || siapkanFoto} className="btn-oranye mt-4 h-12 w-full">
          <IkonCentang className="h-5 w-5" strokeWidth={2.4} />
          {busy ? "Menyimpan…" : produk ? "Simpan Perubahan" : "Tambah ke Menu"}
        </button>

        {produk && (
          <button
            type="button"
            onClick={hapus}
            disabled={busy}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            <IkonSampah className="h-4 w-4" />
            Hapus menu ini
          </button>
        )}
      </form>
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(null); // id produk yang barusan tersimpan
  const [form, setForm] = useState(null); // null = tertutup, { produk } — produk null berarti tambah baru
  const [kabar, setKabar] = useState(null);

  const muat = async () => {
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (error) alert("Gagal memuat produk: " + error.message);
    setProducts(urutkan(data || []));
    setLoading(false);
  };

  useEffect(() => {
    muat();
  }, []);

  useEffect(() => {
    if (!kabar) return;
    const t = setTimeout(() => setKabar(null), 2500);
    return () => clearTimeout(t);
  }, [kabar]);

  const update = async (id, patch) => {
    const { error } = await supabase.from("products").update(patch).eq("id", id);
    if (error) return alert("Gagal menyimpan: " + error.message);
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaved(id);
    setTimeout(() => setSaved((s) => (s === id ? null : s)), 1500);
  };

  // Dipanggil form setelah produknya tersimpan; tinggal rapikan urutan semua menu
  const simpanDaftar = async (list, pesan) => {
    try {
      setProducts(await simpanUrutan(list));
    } catch (e) {
      alert(e.message);
      await muat();
    }
    setForm(null);
    setKabar(pesan);
  };

  const hapus = async (p) => {
    // order_items.product_id mengunci produk (foreign key). Nama & harga sudah tersalin
    // di tiap item pesanan, jadi tautannya cukup dilepas supaya produk bisa dihapus.
    const lepas = await supabase.from("order_items").update({ product_id: null }).eq("product_id", p.id);
    if (lepas.error) throw new Error("Gagal melepas riwayat pesanan: " + lepas.error.message);
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) throw new Error("Gagal menghapus: " + error.message);
    setProducts((ps) => ps.filter((x) => x.id !== p.id));
    setForm(null);
    setKabar(`"${p.name}" dihapus dari menu`);
  };

  if (loading)
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-3xl bg-brand-100/80" />
        ))}
      </div>
    );

  const nAktif = products.filter((p) => p.active).length;

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          <b className="text-coklat-900">{nAktif} aktif</b> · {products.length - nAktif} nonaktif
        </p>
        <button type="button" onClick={() => setForm({ produk: null })} className="btn-oranye h-11 px-4 text-sm">
          <IkonPlus className="h-4 w-4" strokeWidth={2.6} />
          Tambah Menu
        </button>
      </div>

      <ul className="space-y-2">
        {products.map((p) => (
          <li key={p.id} className="kartu flex items-center gap-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image_url}
              alt={p.name}
              className={`h-14 w-14 shrink-0 rounded-2xl object-cover ${p.active ? "" : "opacity-60 grayscale"}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold leading-snug ${p.active ? "" : "text-stone-400"}`}>{p.name}</p>
              {(p.weight || p.badge) && (
                <p className="mt-0.5 flex flex-wrap gap-1 text-[10px] font-bold uppercase tracking-wide">
                  {p.weight && <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-coklat-700">{p.weight}</span>}
                  {p.badge && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-red-600">★ {p.badge}</span>}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <label className="relative">
                  <span className="sr-only">Harga {p.name}</span>
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-400">
                    Rp
                  </span>
                  <input
                    // key ikut harga: kalau harga diubah lewat form, kolom ini ikut ter-reset
                    key={p.price}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="500"
                    defaultValue={p.price}
                    onBlur={(e) => {
                      const v = Math.max(0, Math.floor(Number(e.target.value)) || 0);
                      e.target.value = v;
                      if (v !== p.price) update(p.id, { price: v });
                    }}
                    className="h-9 w-28 rounded-xl border border-brand-100 bg-white pl-9 pr-2 text-sm font-semibold tabular-nums focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setForm({ produk: p })}
                  aria-label={`Ubah ${p.name}`}
                  className="btn-lembut h-9 px-3.5 text-xs"
                >
                  Ubah
                </button>
                {saved === p.id && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700" role="status">
                    <IkonCentang className="h-3.5 w-3.5" strokeWidth={2.6} />
                    Tersimpan
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={p.active}
              aria-label={`Tampilkan ${p.name} di katalog`}
              onClick={() => update(p.id, { active: !p.active })}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <span className={`relative h-7 w-12 rounded-full transition ${p.active ? "bg-green-500" : "bg-stone-300"}`}>
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    p.active ? "left-[1.375rem]" : "left-0.5"
                  }`}
                />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
                {p.active ? "Aktif" : "Nonaktif"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="pt-4 text-center text-xs leading-relaxed text-stone-500">
        Harga tersimpan begitu kamu keluar dari kolom. Ketuk <b>Ubah</b> buat ganti nama, foto, berat, label,
        urutan, atau hapus menu. Produk nonaktif nggak tampil di katalog.
      </p>

      {form && (
        <FormMenu
          produk={form.produk}
          daftar={products}
          onTutup={() => setForm(null)}
          onSimpan={simpanDaftar}
          onHapus={hapus}
        />
      )}

      {kabar && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-full bg-coklat-900 px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          <IkonCentang className="h-4 w-4 shrink-0" strokeWidth={2.6} />
          {kabar}
        </p>
      )}
    </div>
  );
}
