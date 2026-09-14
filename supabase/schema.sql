-- ============================================
-- PO Kripik - Schema Supabase
-- Cara pakai: buka Supabase Dashboard -> SQL Editor
-- -> paste semua isi file ini -> Run
-- ============================================

-- Tabel produk
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null default 0,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tabel pesanan
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  notes text,
  total integer not null default 0,
  status text not null default 'baru',
  payment_proof_url text,
  created_at timestamptz not null default now()
);

-- Tabel item pesanan
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  price integer not null default 0,
  qty integer not null default 1
);

-- RLS (akses via anon key dari web)
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "products read" on products;
create policy "products read" on products for select using (true);
drop policy if exists "products update" on products;
create policy "products update" on products for update using (true);

drop policy if exists "orders insert" on orders;
create policy "orders insert" on orders for insert with check (true);
drop policy if exists "orders read" on orders;
create policy "orders read" on orders for select using (true);
drop policy if exists "orders update" on orders;
create policy "orders update" on orders for update using (true);

drop policy if exists "order_items insert" on order_items;
create policy "order_items insert" on order_items for insert with check (true);
drop policy if exists "order_items read" on order_items;
create policy "order_items read" on order_items for select using (true);

-- Storage bucket untuk bukti pembayaran
insert into storage.buckets (id, name, public)
values ('bukti', 'bukti', true)
on conflict (id) do nothing;

drop policy if exists "bukti upload" on storage.objects;
create policy "bukti upload" on storage.objects
  for insert with check (bucket_id = 'bukti');
drop policy if exists "bukti read" on storage.objects;
create policy "bukti read" on storage.objects
  for select using (bucket_id = 'bukti');

-- ============================================
-- Seed produk (harga masih contoh, ubah di halaman /admin)
-- ============================================
insert into products (name, price, image_url) values
  ('Batagor Kering', 15000, '/produk/batagor-kering.jpg'),
  ('Kentang Manohara Asin Balado', 18000, '/produk/kentang-manohara.jpg'),
  ('Makaroni Rujak', 12000, '/produk/makaroni-rujak.jpg'),
  ('Rengginang', 15000, '/produk/rengginang.jpg'),
  ('Sale Pisang Jari', 15000, '/produk/sale-pisang-jari.jpg'),
  ('Samosa', 15000, '/produk/samosa.jpg'),
  ('Simping Kencur', 12000, '/produk/simping-kencur.jpg'),
  ('Soes Isi Keju Coklat Blueberry', 20000, '/produk/soes-isi.jpg'),
  ('Soes Tunas', 18000, '/produk/soes-tunas.jpg'),
  ('Sumpia Udang', 17000, '/produk/sumpia-udang.jpg'),
  ('Tahu Walik', 15000, '/produk/tahu-walik.jpg'),
  ('Telur Gabus Manis Wijen', 14000, '/produk/telur-gabus.jpg');
