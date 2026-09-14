"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Logo } from "../../components/Brand";
import { IkonGembok, IkonKeluar, IkonSilang } from "../../components/Ikon";
import Orders from "../../components/admin/Orders";
import Products from "../../components/admin/Products";
import Batches from "../../components/admin/Batches";
import Export from "../../components/admin/Export";
import Qris from "../../components/admin/Qris";

const TABS = [
  ["pesanan", "Pesanan"],
  ["batch", "Batch"],
  ["produk", "Produk"],
  ["qris", "QRIS"],
  ["ekspor", "Ekspor"],
];

function Merek() {
  return (
    <div className="text-center">
      <Logo className="mx-auto h-20 w-20" />
      <p className="mt-2 font-display text-3xl leading-none">PO KRIPIK</p>
      <span className="mt-2 inline-block rounded-full bg-coklat-900 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
        Admin
      </span>
    </div>
  );
}

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
    <main className="px-4 pb-10 pt-14">
      <Merek />
      <form onSubmit={masuk} className="kartu mt-6 space-y-4 p-5">
        <div>
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <IkonGembok className="h-5 w-5 text-brand-600" />
            Masuk dulu
          </p>
          <p className="text-sm text-stone-500">Buat kelola pesanan, batch, dan produk.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-semibold">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-semibold">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="input"
          />
        </div>
        {err && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <IkonSilang className="mt-0.5 h-4 w-4 shrink-0" />
            {err}
          </p>
        )}
        <button disabled={busy} className="btn-oranye h-12 w-full">
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}

function Ditolak({ onKeluar }) {
  return (
    <main className="px-4 pb-10 pt-14">
      <Merek />
      <div className="kartu mt-6 p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-600">
          <IkonSilang className="h-7 w-7" />
        </span>
        <p className="mt-3 text-lg font-extrabold">Akun ini bukan admin</p>
        <p className="mt-1 text-sm text-stone-500">
          Daftarkan dulu user-nya ke tabel <code className="rounded bg-brand-50 px-1">admins</code> lewat SQL
          Editor Supabase.
        </p>
        <button onClick={onKeluar} className="btn-lembut mt-5 h-11 px-5 text-sm">
          <IkonKeluar className="h-4 w-4" />
          Keluar
        </button>
      </div>
    </main>
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
    return (
      <main className="px-4 pt-14 text-center">
        <Logo className="mx-auto h-16 w-16 animate-pulse" />
        <p className="mt-3 text-sm text-stone-500">Memeriksa akses…</p>
      </main>
    );
  if (!isAdmin) return <Ditolak onKeluar={keluar} />;

  const batchBuka = batches.find((b) => b.status === "buka");

  return (
    <main className="pb-10">
      <header className="sticky top-0 z-20 border-b border-brand-100 bg-brand-50/90 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-display text-xl leading-none">
              PO KRIPIK
              <span className="rounded-full bg-coklat-900 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-white">
                Admin
              </span>
            </p>
            <button
              type="button"
              onClick={() => setTab("batch")}
              className="mt-1 flex max-w-full items-center gap-1.5 text-xs font-semibold text-coklat-700"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  batchBuka ? "bg-green-500 ring-4 ring-green-100" : "bg-stone-400 ring-4 ring-stone-200"
                }`}
              />
              <span className="truncate">{batchBuka ? `${batchBuka.name} lagi buka` : "Semua batch tutup"}</span>
            </button>
          </div>
          <button type="button" onClick={keluar} className="btn-lembut h-9 shrink-0 px-3 text-xs">
            <IkonKeluar className="h-4 w-4" />
            Keluar
          </button>
        </div>

        <nav
          role="tablist"
          aria-label="Menu admin"
          className="mt-3 grid grid-cols-5 gap-1 rounded-full border border-brand-100 bg-white p-1 shadow-sm"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-9 rounded-full text-[12px] font-bold transition ${
                tab === id
                  ? "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm"
                  : "text-coklat-700 hover:bg-brand-50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "pesanan" && <Orders batches={batches} />}
      {tab === "batch" && <Batches batches={batches} reload={reloadBatches} />}
      {tab === "produk" && <Products />}
      {tab === "qris" && <Qris />}
      {tab === "ekspor" && <Export batches={batches} />}
    </main>
  );
}
