-- ============================================================
-- PO Kripik - Migrasi: Batch PO + Login Admin (Supabase Auth)
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> paste semua
-- isi file ini -> Run. Aman dijalankan berulang kali.
--
-- PENTING: sebelum Run, bikin dulu user admin di
-- Authentication -> Users -> Add user (email + password).
-- Lalu isi email itu di bagian PENDAFTARAN ADMIN paling bawah.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel batch PO
-- ------------------------------------------------------------
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'buka',   -- 'buka' | 'tutup'
  note text,                             -- info jadwal ambil / catatan buat pembeli
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Cuma boleh ada SATU batch yang statusnya 'buka' dalam satu waktu.
-- Unique index parsial: nilai 'buka' hanya boleh muncul sekali.
create unique index if not exists batches_hanya_satu_buka
  on batches (status) where status = 'buka';

-- Pesanan nempel ke batch
alter table orders add column if not exists batch_id uuid references batches(id);
create index if not exists orders_batch_id_idx on orders (batch_id);

-- ------------------------------------------------------------
-- 2. Daftar admin + helper is_admin()
--    Dipakai semua policy RLS di bawah.
-- ------------------------------------------------------------
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;

drop policy if exists "admins baca diri sendiri" on admins;
create policy "admins baca diri sendiri" on admins
  for select using (auth.uid() = user_id);

-- security definer supaya policy bisa ngintip tabel admins
-- tanpa kejebak RLS tabel itu sendiri (infinite recursion).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ------------------------------------------------------------
-- 3. RLS diperketat
--    Pembeli (anon) TIDAK bisa baca/tulis orders sama sekali.
--    Semua aksi pembeli lewat route API server-side yang pakai
--    service role key (bypass RLS, divalidasi di server).
-- ------------------------------------------------------------
alter table products enable row level security;
alter table batches enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Bersihkan policy permisif dari schema.sql lama
drop policy if exists "products read" on products;
drop policy if exists "products update" on products;
drop policy if exists "orders insert" on orders;
drop policy if exists "orders read" on orders;
drop policy if exists "orders update" on orders;
drop policy if exists "order_items insert" on order_items;
drop policy if exists "order_items read" on order_items;

-- products: katalog publik boleh dibaca siapa saja, tulis khusus admin
drop policy if exists "produk baca publik" on products;
create policy "produk baca publik" on products for select using (true);
drop policy if exists "produk tulis admin" on products;
create policy "produk tulis admin" on products for all
  using (public.is_admin()) with check (public.is_admin());

-- batches: pembeli perlu tahu batch mana yang buka, jadi baca publik
drop policy if exists "batch baca publik" on batches;
create policy "batch baca publik" on batches for select using (true);
drop policy if exists "batch tulis admin" on batches;
create policy "batch tulis admin" on batches for all
  using (public.is_admin()) with check (public.is_admin());

-- orders & order_items: admin only. Pembeli lewat API server.
drop policy if exists "pesanan admin" on orders;
create policy "pesanan admin" on orders for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "item pesanan admin" on order_items;
create policy "item pesanan admin" on order_items for all
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 4. Storage bukti bayar -> jadi PRIVAT
--    Bukti transfer isinya sensitif (nominal, nama rekening),
--    jadi bucket ditutup. Admin lihat lewat signed URL.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bukti', 'bukti', false)
on conflict (id) do update set public = false;

drop policy if exists "bukti upload" on storage.objects;
drop policy if exists "bukti read" on storage.objects;
drop policy if exists "bukti baca admin" on storage.objects;
create policy "bukti baca admin" on storage.objects
  for select using (bucket_id = 'bukti' and public.is_admin());

-- ------------------------------------------------------------
-- 5. Batch pertama (kalau belum ada satu pun)
-- ------------------------------------------------------------
insert into batches (name, status, note)
select 'Batch 1', 'buka', 'Batch pertama — ubah namanya di /admin tab Batch.'
where not exists (select 1 from batches);

-- Pesanan lama yang belum punya batch, tempelkan ke batch paling awal
update orders set batch_id = (select id from batches order by created_at limit 1)
where batch_id is null;

-- ============================================================
-- 6. PENDAFTARAN ADMIN  <<<< GANTI EMAIL DI BAWAH INI
--    Pakai email user yang tadi kamu bikin di Authentication.
-- ============================================================
insert into admins (user_id, email)
select id, email from auth.users
where email = 'GANTI_DENGAN_EMAIL_ADMIN_KAMU'
on conflict (user_id) do nothing;

-- Cek hasilnya: harus keluar 1 baris. Kalau kosong, emailnya salah ketik.
select * from admins;
