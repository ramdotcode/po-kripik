"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Batches({ batches, reload }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
  const buka = async (id) => {
    setBusy(true);
    setErr("");
    const open = batches.filter((b) => b.status === "buka" && b.id !== id);
    for (const b of open) {
      await supabase
        .from("batches")
        .update({ status: "tutup", closed_at: new Date().toISOString() })
        .eq("id", b.id);
    }
    const { error } = await supabase
      .from("batches")
      .update({ status: "buka", closed_at: null })
      .eq("id", id);
    if (error) setErr("Gagal membuka batch: " + error.message);
    await reload();
    setBusy(false);
  };

  const tutup = async (id) => {
    setBusy(true);
    setErr("");
    const { error } = await supabase
      .from("batches")
      .update({ status: "tutup", closed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) setErr("Gagal menutup batch: " + error.message);
    await reload();
    setBusy(false);
  };

  const ubahNote = async (id, value) => {
    await supabase.from("batches").update({ note: value.trim() || null }).eq("id", id);
    await reload();
  };

  const ubahNama = async (id, value) => {
    const v = value.trim();
    if (!v) return;
    await supabase.from("batches").update({ name: v }).eq("id", id);
    await reload();
  };

  return (
    <div className="space-y-4 p-4">
      <form onSubmit={buat} className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 font-bold">➕ Batch baru</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nama batch (default: ${nextName})`}
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-brand-500"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan buat pembeli (mis. ambil 12 Sep)"
          className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-brand-500"
        />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <button
          disabled={busy}
          className="mt-3 w-full rounded-2xl bg-brand-600 py-3 font-bold text-white disabled:opacity-50"
        >
          Bikin Batch
        </button>
        <p className="mt-2 text-center text-xs text-stone-400">
          Batch baru dibikin dalam keadaan tutup. Buka manual kalau siap.
        </p>
      </form>

      {batches.map((b) => (
        <div key={b.id} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <input
              defaultValue={b.name}
              onBlur={(e) => e.target.value.trim() !== b.name && ubahNama(b.id, e.target.value)}
              className="flex-1 rounded-lg border border-transparent px-1 py-0.5 font-extrabold hover:border-stone-200 focus:border-stone-200 focus:outline-none"
            />
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                b.status === "buka" ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"
              }`}
            >
              {b.status === "buka" ? "Buka" : "Tutup"}
            </span>
          </div>

          <input
            defaultValue={b.note || ""}
            onBlur={(e) => (e.target.value.trim() || null) !== b.note && ubahNote(b.id, e.target.value)}
            placeholder="Catatan buat pembeli…"
            className="mt-2 w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm outline-brand-500"
          />

          <p className="mt-2 text-xs text-stone-400">
            Dibuat {new Date(b.created_at).toLocaleDateString("id-ID")}
            {b.closed_at && ` • ditutup ${new Date(b.closed_at).toLocaleDateString("id-ID")}`}
          </p>

          <button
            disabled={busy}
            onClick={() => (b.status === "buka" ? tutup(b.id) : buka(b.id))}
            className={`mt-3 w-full rounded-2xl py-2.5 text-sm font-bold disabled:opacity-50 ${
              b.status === "buka"
                ? "bg-stone-200 text-stone-700"
                : "bg-brand-600 text-white"
            }`}
          >
            {b.status === "buka" ? "Tutup PO ini" : "Buka PO ini"}
          </button>
          {b.status !== "buka" && batches.some((x) => x.status === "buka") && (
            <p className="mt-1.5 text-center text-xs text-stone-400">
              Membuka ini otomatis menutup batch yang lagi buka.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
