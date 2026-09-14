"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Orders from "../../components/admin/Orders";
import Products from "../../components/admin/Products";
import Batches from "../../components/admin/Batches";
import Export from "../../components/admin/Export";

const TABS = [
  ["pesanan", "Pesanan"],
  ["batch", "Batch"],
  ["produk", "Produk"],
  ["ekspor", "Ekspor"],
];

function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const masuk = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pw,
    });
    if (error) {
      setErr("Email atau password salah.");
      setBusy(false);
    }
    // Kalau berhasil, onAuthStateChange di Admin yang ambil alih.
  };

  return (
    <form onSubmit={masuk} className="p-8">
      <h1 className="mb-1 text-center text-lg font-extrabold">🔐 Admin PO Kripik</h1>
      <p className="mb-5 text-center text-sm text-stone-500">Masuk buat kelola pesanan</p>
      <input
        type="email"
        required
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email admin"
        className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-brand-500"
      />
      <input
        type="password"
        required
        autoComplete="current-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="Password"
        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-brand-500"
      />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button
        disabled={busy}
        className="mt-3 w-full rounded-2xl bg-brand-600 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}

function Ditolak({ onKeluar }) {
  return (
    <div className="p-8 text-center">
      <p className="text-3xl">🚫</p>
      <p className="mt-2 font-bold">Akun ini bukan admin.</p>
      <p className="mt-1 text-sm text-stone-500">
        Daftarkan dulu user-nya ke tabel <code>admins</code> lewat SQL Editor Supabase.
      </p>
      <button onClick={onKeluar} className="mt-4 font-semibold text-brand-600 underline">
        Keluar
      </button>
    </div>
  );
}

export default function Admin() {
  const [session, setSession] = useState(undefined); // undefined = belum dicek
  const [isAdmin, setIsAdmin] = useState(null); // null = belum dicek
  const [tab, setTab] = useState("pesanan");
  const [batches, setBatches] = useState([]);

  const reloadBatches = useCallback(async () => {
    const { data } = await supabase
      .from("batches")
      .select("*")
      .order("created_at", { ascending: false });
    setBatches(data || []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s || null);
      setIsAdmin(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Punya sesi belum tentu admin — dicek ke tabel admins.
  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const ok = Boolean(data);
      setIsAdmin(ok);
      if (ok) await reloadBatches();
    })();
  }, [session, reloadBatches]);

  const keluar = async () => {
    await supabase.auth.signOut();
    setIsAdmin(null);
  };

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (isAdmin === null)
    return <p className="p-8 text-center text-sm text-stone-500">Memeriksa akses…</p>;
  if (!isAdmin) return <Ditolak onKeluar={keluar} />;

  const batchBuka = batches.find((b) => b.status === "buka");

  return (
    <main className="pb-10">
      <header className="sticky top-0 z-10 bg-stone-800 px-4 py-4 text-white shadow">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-extrabold">⚙️ Admin PO Kripik</h1>
            <p className="text-xs text-stone-400">
              {batchBuka ? `🟢 ${batchBuka.name} lagi buka` : "🔴 Semua batch tutup"}
            </p>
          </div>
          <button onClick={keluar} className="text-xs font-semibold text-stone-300 underline">
            Keluar
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${
                tab === id ? "bg-brand-500 text-white" : "bg-stone-700 text-stone-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "pesanan" && <Orders batches={batches} />}
      {tab === "batch" && <Batches batches={batches} reload={reloadBatches} />}
      {tab === "produk" && <Products />}
      {tab === "ekspor" && <Export batches={batches} />}
    </main>
  );
}
