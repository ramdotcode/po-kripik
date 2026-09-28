-- ============================================================
-- PO Kripik - Migrasi: berat, badge, dan urutan menu (poster 15 Sep 2026)
--
-- Aman dijalankan berulang kali. Web tetap jalan walau file ini belum
-- dijalankan — berat/badge cuma belum tampil dan urutan jatuh ke abjad.
--
-- 15 Sep 2026: Kentang Manohara Seaweed keluar dari menu (dinonaktifkan, bukan
-- dihapus — sudah ada di order_items), Keripik Kentang Asin/Pedes masuk di
-- urutan terakhir Halaman 1.
--
-- 27 Sep 2026: Telur Gabus Keju (29K/250gr) masuk tepat setelah Telur Gabus
-- Manis Wijen; menu sesudahnya bergeser satu. Keripik Gadung (35K, berat
-- sengaja tidak dicantumkan) masuk di urutan paling akhir.
--
-- 28 Sep 2026: Keripik Gadung jadi "Keripik Gadung (Kentang Putih)"; label BARU
-- untuk Telur Gabus Keju & Keripik Gadung (Kentang Putih).
-- ============================================================

alter table products add column if not exists weight text;        -- mis. '250gr'
alter table products add column if not exists badge text;         -- 'FAVORIT' | 'BARU' | null
alter table products add column if not exists sort_order integer;  -- urutan tampil = urutan poster

insert into products (name, price, image_url, active)
select 'Keripik Kentang Asin/Pedes', 40000, '/produk/keripik-kentang.jpg', true
where not exists (select 1 from products where name = 'Keripik Kentang Asin/Pedes');

insert into products (name, price, image_url, active)
select 'Telur Gabus Keju', 29000, '/produk/telur-gabus-keju.jpg', true
where not exists (select 1 from products where name = 'Telur Gabus Keju');

update products set name = 'Keripik Gadung (Kentang Putih)' where name = 'Keripik Gadung';

insert into products (name, price, image_url, active)
select 'Keripik Gadung (Kentang Putih)', 35000, '/produk/keripik-gadung.jpg', true
where not exists (select 1 from products where name = 'Keripik Gadung (Kentang Putih)');

update products
set active = false, badge = null, sort_order = null
where name = 'Kentang Manohara Seaweed';

update products p
set weight = v.weight, badge = v.badge, sort_order = v.urut
from (values
  -- Halaman 1
  ('Batagor Kering',                                            '250gr', 'FAVORIT',  1),
  ('Batagor Kering Pedes',                                      '250gr', 'BARU',     2),
  ('Makaroni Rujak',                                            '200gr', 'FAVORIT',  3),
  ('Rengginang Mini',                                           '250gr', 'FAVORIT',  4),
  ('Simping Kencur',                                            '200gr', null,       5),
  ('Sumpia Udang',                                              '250gr', null,       6),
  ('Samosa',                                                    '200gr', null,       7),
  ('Telur Gabus Manis Wijen',                                   '250gr', null,       8),
  ('Telur Gabus Keju',                                          '250gr', 'BARU',     9),
  ('Keripik Kentang Asin/Pedes',                                '250gr', null,      10),
  -- Halaman 2
  ('Pisang Coklat Lampung',                                     '250gr', null,      11),
  ('Pisang Sale Lidah',                                         '250gr', null,      12),
  ('Kremes Ubi',                                                '250gr', null,      13),
  ('Soes Mini Kering (Tanpa Isi)',                              '250gr', null,      14),
  ('Soes Kering Isi Coklat/Susu Vanilla/Blueberry/Keju Lumer',  '250gr', null,      15),
  ('Tahu Walik Kering',                                         '200gr', null,      16),
  ('Keripik Gadung (Kentang Putih)',                            null,    'BARU',    17)
) as v(name, weight, badge, urut)
where p.name = v.name;

-- Cek: harus 17 baris aktif, semuanya punya urutan (berat Keripik Gadung (Kentang Putih) sengaja kosong)
select sort_order, name, price, weight, badge, active
from products order by active desc, sort_order nulls last, name;
