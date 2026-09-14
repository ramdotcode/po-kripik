-- ============================================================
-- PO Kripik - Migrasi: Pembayaran QRIS otomatis (Midtrans)
--
-- Jalankan SETELAH migration-batch-auth.sql (butuh fungsi is_admin()).
-- Aman dijalankan berulang kali.
-- ============================================================

-- Penanda pesanan sudah dibayar (dipakai jalur otomatis & ditampilkan di admin)
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists paid_via text;  -- 'midtrans' | 'manual'

-- Satu baris per QR yang dibuat ke Midtrans. QR kedaluwarsa -> baris baru,
-- jadi satu pesanan bisa punya beberapa intent.
create table if not exists payment_intents (
  order_ref   text primary key,             -- order_id yang dikirim ke Midtrans (unik per QR)
  order_id    uuid not null references orders(id) on delete cascade,
  amount      integer not null,             -- nominal yang ditagih, dicocokkan saat lunas
  status      text not null default 'pending', -- transaction_status Midtrans terakhir
  qr_url      text,
  expiry_time timestamptz,
  payload     jsonb,                        -- respons charge utuh
  notif       jsonb,                        -- status terakhir dari Midtrans
  checked_at  timestamptz,                  -- terakhir cek status langsung ke Midtrans
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists payment_intents_order_idx
  on payment_intents (order_id, created_at desc);

alter table payment_intents enable row level security;

drop policy if exists "intent baca admin" on payment_intents;
create policy "intent baca admin" on payment_intents
  for select using (public.is_admin());

-- Penulisan KHUSUS server (service role bypass RLS). Policy RESTRICTIVE supaya
-- tetap terkunci walau suatu saat ada yang menambah policy permisif —
-- "tanpa policy = tertutup" itu rapuh (catatan IMPROVEMENTS.md elevra #3).
drop policy if exists "intent tanpa insert" on payment_intents;
create policy "intent tanpa insert" on payment_intents
  as restrictive for insert with check (false);
drop policy if exists "intent tanpa update" on payment_intents;
create policy "intent tanpa update" on payment_intents
  as restrictive for update using (false);
drop policy if exists "intent tanpa delete" on payment_intents;
create policy "intent tanpa delete" on payment_intents
  as restrictive for delete using (false);
