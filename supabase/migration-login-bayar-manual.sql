-- ============================================================
-- PO Kripik - Migrasi: login pembeli (Google) + bayar manual QRIS statis
--
-- Jalankan SETELAH migration-batch-auth.sql & migration-midtrans.sql.
-- Aman dijalankan berulang kali.
-- ============================================================

-- 1. Pesanan milik akun pembeli -----------------------------------------------
alter table orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table orders add column if not exists customer_email text;  -- email akun Google, buat admin
alter table orders add column if not exists proof_note text;      -- alasan admin menolak bukti (null = tidak ada)
create index if not exists orders_user_id_idx on orders (user_id, created_at desc);

-- Pembeli boleh MEMBACA pesanan & item miliknya sendiri. Membuat pesanan &
-- upload bukti tetap lewat route API server (harga dihitung ulang di server).
drop policy if exists "pesanan baca pemilik" on orders;
create policy "pesanan baca pemilik" on orders
  for select using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "item pesanan baca pemilik" on order_items;
create policy "item pesanan baca pemilik" on order_items
  for select using (exists (
    select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid()
  ));

-- 2. Pengaturan toko (gambar QRIS statis) -------------------------------------
create table if not exists settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table settings enable row level security;

drop policy if exists "settings baca publik" on settings;
create policy "settings baca publik" on settings for select using (true);
drop policy if exists "settings tulis admin" on settings;
create policy "settings tulis admin" on settings for all
  using (public.is_admin()) with check (public.is_admin());

insert into settings (key, value) values ('qris_url', null) on conflict (key) do nothing;

-- 3. Bucket PUBLIK 'toko' buat gambar QRIS; upload & hapus khusus admin ------
insert into storage.buckets (id, name, public) values ('toko', 'toko', true)
on conflict (id) do update set public = true;

drop policy if exists "toko upload admin" on storage.objects;
create policy "toko upload admin" on storage.objects
  for insert with check (bucket_id = 'toko' and public.is_admin());
drop policy if exists "toko hapus admin" on storage.objects;
create policy "toko hapus admin" on storage.objects
  for delete using (bucket_id = 'toko' and public.is_admin());

-- Cek: harus keluar 1 baris qris_url (value masih kosong sampai admin upload)
select key, value from settings;
