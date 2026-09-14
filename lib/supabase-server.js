import { createClient } from "@supabase/supabase-js";

// Client khusus server (route handler). Pakai service role key -> bypass RLS.
// JANGAN pernah diimport dari komponen "use client": key-nya tidak ber-prefix
// NEXT_PUBLIC_ jadi di browser nilainya undefined dan query bakal gagal.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(
  url || "https://placeholder.supabase.co",
  serviceKey || "placeholder",
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Placeholder dari .env.local.example dihitung sebagai "belum diisi".
export const serviceKeyReady = Boolean(
  url && serviceKey && !/^ISI_|^isi-/.test(serviceKey)
);
