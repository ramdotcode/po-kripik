import { supabaseAdmin } from "./supabase-server";

// User dari header "Authorization: Bearer <access_token>" (dikirim fetchAuth di browser).
// Token diverifikasi ke Supabase — JANGAN pernah percaya user_id kiriman browser.
export async function userDariRequest(req) {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
