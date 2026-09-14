-- ============================================================
-- PO Kripik - Migrasi: kode unik per akun (3 digit terakhir nominal transfer)
--
-- Jalankan SETELAH migration-login-bayar-manual.sql. Aman dijalankan berulang.
-- Nominal transfer = orders.total + orders.kode_unik  (mis. 54.000 + 37 = 54.037)
-- ============================================================

-- 1. Satu kode tetap per akun, 1–999, tidak boleh kembar antar akun
create table if not exists kode_unik (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  kode       smallint not null unique check (kode between 1 and 999),
  created_at timestamptz not null default now()
);
alter table kode_unik enable row level security;

drop policy if exists "kode baca sendiri" on kode_unik;
create policy "kode baca sendiri" on kode_unik for select using (auth.uid() = user_id);
drop policy if exists "kode baca admin" on kode_unik;
create policy "kode baca admin" on kode_unik for select using (public.is_admin());
-- Tulis: cuma lewat fungsi di bawah (dipanggil server dengan service role)

-- 2. Salinan kode di tiap pesanan (kode akun bisa saja berubah nanti, pesanan lama tetap)
alter table orders add column if not exists kode_unik smallint;

-- 3. Ambil kode akun; kalau belum punya, pilih acak dari yang masih kosong.
--    Dua akun baru yang pesan bersamaan & kebetulan dapat angka sama -> unique
--    violation -> coba angka lain (maks 10x).
create or replace function public.ambil_kode_unik(p_user uuid)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  k smallint;
begin
  select kode into k from kode_unik where user_id = p_user;
  if k is not null then return k; end if;

  for i in 1..10 loop
    select c::smallint into k
    from generate_series(1, 999) c
    where not exists (select 1 from kode_unik ku where ku.kode = c)
    order by random()
    limit 1;
    if k is null then raise exception 'Kode unik 1-999 sudah habis terpakai'; end if;
    begin
      insert into kode_unik (user_id, kode) values (p_user, k);
      return k;
    exception when unique_violation then
      -- akun ini keburu dapat kode di request lain, atau angkanya keburu dipakai akun lain
      select kode into k from kode_unik where user_id = p_user;
      if k is not null then return k; end if;
    end;
  end loop;
  raise exception 'Gagal membuat kode unik, coba lagi';
end $$;

revoke all on function public.ambil_kode_unik(uuid) from public, anon, authenticated;
grant execute on function public.ambil_kode_unik(uuid) to service_role;

-- 4. Beri kode ke akun yang sudah pernah pesan & tempel ke pesanannya yang belum dibayar
do $$
declare r record;
begin
  for r in select distinct user_id from orders where user_id is not null loop
    perform public.ambil_kode_unik(r.user_id);
  end loop;
end $$;

update orders o set kode_unik = ku.kode
from kode_unik ku
where o.user_id = ku.user_id and o.kode_unik is null and o.status in ('baru', 'menunggu_konfirmasi');

-- Cek
select ku.kode, count(o.id) as pesanan
from kode_unik ku left join orders o on o.user_id = ku.user_id
group by ku.kode order by ku.kode;
