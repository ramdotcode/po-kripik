"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Login PEMBELI pakai Google (Supabase Auth). Admin tetap email+password di /admin.
// `kembaliKe` = path tujuan setelah login, mis. "/keranjang".
export function masukGoogle(kembaliKe = "/") {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${kembaliKe}` },
  });
}

export const keluar = () => supabase.auth.signOut();

// undefined = belum dicek, null = belum login, object = sesi aktif
export function useSesi() {
  const [sesi, setSesi] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesi(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesi(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return sesi;
}

// fetch ke route API kita sambil membawa token login.
// Server memverifikasi token itu ke Supabase (lib/auth-server.js).
export async function fetchAuth(url, opts = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

export const namaAkun = (user) => user?.user_metadata?.full_name || user?.user_metadata?.name || "";
