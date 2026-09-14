"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { IkonCentang, IkonPlus } from "../Ikon";

const tanggal = (d) =>
  new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function Batches({ batches, reload }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tersimpan, setTersimpan] = useState(null); // id batch yang barusan diedit
  const [jumlah, setJumlah] = useState({}); // batch_id -> jumlah pesanan (tanpa batal)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orders").select("batch_id, status");
      const m = {};
      for (const o of data || []) if (o.status !== "batal") m[o.batch_id] = (m[o.batch_id] || 0) + 1;
      setJumlah(m);
    })();
  }, []);

  const nextName = `Batch ${batches.length + 1}`;

  const buat = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase
      .from("batches")
      .insert({ name: name.trim() || nextName, note: note.trim() || null, status: "tutup" });
    if (error) setErr("Gagal bikin batch: " + error.message);
    else {
      setName("");
      setNote("");
      await reload();
    }
    setBusy(false);
  };

  // Cuma boleh satu batch buka (dijaga unique index di database),
  // jadi tutup dulu yang lain sebelum membuka yang ini.
  const buka = async (b) => {
    const open = batches.filter((x) => x.status === "buka" && x.id !== b.id);
    const tanya = open.length
      ? `Buka ${b.name}? ${open.map((x) => x.name).join(", ")} otomatis ditutup.`
      : `Buka ${b.name}? Pembeli langsung bisa pesan.`;
    if (!window.confirm(tanya)) return;

    setBusy(true);
    setErr("");
    for (const x of open) {
      await supabase
        .from("batches")
        .update({ status: "tutup", closed_at: new Date().toISOString() })
        .eq("id", x.id);
    }
    const { error } = await supabase
      .from("batches")
      .update({ status: "buka", closed_at: null })
      .eq("id", b.id);
    if (error) setErr("Gagal membuka batch: " + error.message);
    await reload();
    setBusy(false);
  };

  const tutup = async (b) => {
    if (!window.confirm(`Tutup ${b.name}? Pembeli nggak bisa pesan sampai ada batch yang dibuka lagi.`)) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase
      .from("batches")
      .update({ status: "tutup", closed_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) setErr("Gagal menutup batch: " + error.message);
    await reload();
    setBusy(false);
  };

  const ubah = async (id, patch) => {
    const { error } = await supabase.from("batches").update(patch).eq("id", id);
    if (error) return setErr("Gagal menyimpan: " + error.message);
    await reload();
    setTersimpan(id);
    setTimeout(() => setTersimpan((t) => (t === id ? null : t)), 1500);
  };

  return (
    <div className="space-y-3 p-4">
      <form onSubmit={buat} className="kartu space-y-3 p-4">
        <p className="flex items-center gap-2 font-extrabold">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-brand-600">
            <IkonPlus className="h-4 w-4" strokeWidth={2.6} />
          </span>
          Batch baru
        </p>
        <div className="space-y-1.5">
          <label htmlFor="batch-nama" className="text-sm font-semibold">
            Nama batch
          </label>
          <input
            id="batch-nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Kosongkan = ${nextName}`}
            className="input py-2.5 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="batch-catatan" className="text-sm font-semibold">
            Catatan buat pembeli <span className="font-normal text-stone-400">(opsional)</span>
          </label>
          <input
            id="batch-catatan"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Mis. diantar Sabtu 4 Okt"
            className="input py-2.5 text-sm"
          />
        </div>
        <button disabled={busy} className="btn-oranye h-12 w-full">
          Bikin Batch
        </button>
        <p className="text-center text-xs text-stone-500">Batch baru dibikin dalam keadaan tutup. Buka kalau siap.</p>
      </form>

      {err && (
        <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {err}
        </p>
      )}

      {batches.map((b) => {
        const isBuka = b.status === "buka";
        return (
          <article key={b.id} className={`kartu p-4 ${isBuka ? "ring-2 ring-green-300" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Nama batch</span>
                <input
                  defaultValue={b.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (!v) e.target.value = b.name;
                    else if (v !== b.name) ubah(b.id, { name: v });
                  }}
                  className="-ml-2 w-full rounded-xl border border-transparent bg-transparent px-2 py-1 text-lg font-extrabold hover:border-brand-100 focus:border-brand-400 focus:bg-white focus:outline-none"
                />
              </label>
              <span
                className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  isBuka ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isBuka ? "bg-green-500" : "bg-stone-400"}`} />
                {isBuka ? "Buka" : "Tutup"}
              </span>
            </div>

            <label className="mt-2 block space-y-1">
              <span className="text-xs font-semibold text-stone-500">Catatan buat pembeli</span>
              <input
                defaultValue={b.note || ""}
                onBlur={(e) => (e.target.value.trim() || null) !== b.note && ubah(b.id, { note: e.target.value.trim() || null })}
                placeholder="Belum ada catatan"
                className="input py-2.5 text-sm"
              />
            </label>

            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 font-bold text-coklat-700 ring-1 ring-brand-100">
                {jumlah[b.id] || 0} pesanan
              </span>
              <span>
                Dibuat {tanggal(b.created_at)}
                {b.closed_at && ` · ditutup ${tanggal(b.closed_at)}`}
              </span>
              {tersimpan === b.id && (
                <span className="inline-flex items-center gap-1 font-semibold text-green-700" role="status">
                  <IkonCentang className="h-3.5 w-3.5" strokeWidth={2.6} />
                  Tersimpan
                </span>
              )}
            </p>

            {isBuka ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => tutup(b)}
                className="mt-3 h-11 w-full rounded-full bg-stone-200 text-sm font-bold text-stone-700 transition active:scale-[0.98] disabled:opacity-50"
              >
                Tutup PO ini
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => buka(b)} className="btn-oranye mt-3 h-11 w-full text-sm">
                Buka PO ini
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
