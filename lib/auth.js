"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Client ID OAuth Google. Ini PUBLIK (memang ikut terkirim ke browser), bukan secret.
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "677424731904-nar4ehpc98tlqhh9bnare057sjopl640.apps.googleusercontent.com";

// Muat Google Identity Services (tombol login resmi Google) sekali per halaman.
let gisPromise = null;
export function muatGis() {
  if (typeof window === "undefined") return Promise.reject(new Error("Bukan di browser"));
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () =>
        window.google?.accounts?.id ? resolve(window.google) : reject(new Error("Google Sign-In tidak siap"));
      s.onerror = () => {
        gisPromise = null; // biar bisa dicoba lagi
        reject(new Error("Gagal memuat Google Sign-In"));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

// Nonce sekali pakai: hash SHA-256 (hex) dikirim ke Google, versi mentahnya ke Supabase.
// Supabase mencocokkan keduanya, jadi token Google curian nggak bisa dipakai ulang.
export async function buatNonce() {
  const mentah = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(mentah));
  const hex = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
  return { mentah, hex };
}

// CADANGAN: login redirect lewat Supabase (alamat supabase.co kelihatan di layar Google).
// Cuma dipakai kalau tombol Google Identity Services gagal dimuat.
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
