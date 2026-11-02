-- =====================================================================
--  Demir Defteri — Supabase (PostgreSQL) şeması
--  Supabase Dashboard → SQL Editor → bu dosyanın tamamını yapıştır → Run
--  Birden fazla kez çalıştırmak güvenlidir (if not exists / or replace).
-- =====================================================================

-- updated_at otomatik güncellensin
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------
-- 1) Besin kayıtları: her satır bir öğündeki bir yiyecek
-- ---------------------------------------------------------------
create table if not exists public.food_entries (
  id          text primary key,                       -- uygulamanın ürettiği kimlik
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day         date not null,
  meal        text,                                   -- kahvalti | ara1 | ogle | ara2 | aksam | ara3
  name        text not null,
  grams       numeric(8,1),
  kcal        numeric(8,1) not null default 0,
  protein     numeric(7,1) not null default 0,
  carb        numeric(7,1) not null default 0,
  fat         numeric(7,1) not null default 0,
  src         text,                                   -- db | manual | ai | photo | menu
  thumb       text,                                   -- küçük fotoğraf (data:image/jpeg;base64,…)
  logged_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists food_entries_user_day on public.food_entries (user_id, day);

-- ---------------------------------------------------------------
-- 2) Kilo takibi: günde bir satır (id = 'w-' || gün)
-- ---------------------------------------------------------------
create table if not exists public.weights (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day         date not null,
  kg          numeric(5,1) not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, day)
);

-- ---------------------------------------------------------------
-- 3) Antrenmanlar (özet + tüm setler jsonb olarak)
-- ---------------------------------------------------------------
create table if not exists public.workouts (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day         date not null,
  started_at  timestamptz not null,
  name        text not null,                          -- "Full Body A" gibi
  day_key     text,
  style       text,                                   -- old | modern
  seconds     integer not null default 0,             -- süre
  volume      numeric(10,1) not null default 0,       -- toplam kg × tekrar
  sets        integer not null default 0,
  prs         integer not null default 0,             -- o antrenmandaki rekor sayısı
  exercises   jsonb not null default '[]'::jsonb,     -- [{exId, sets:[{kg,reps,rpe,t}]}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists workouts_user_day on public.workouts (user_id, day);

-- ---------------------------------------------------------------
-- 4) Setler: SQL ile analiz için satır satır (uygulama antrenman kaydında yeniden üretir)
-- ---------------------------------------------------------------
create table if not exists public.workout_sets (
  workout_id    text not null references public.workouts(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day           date not null,
  exercise_id   text not null,                        -- squat, bench, …
  exercise_name text,
  set_no        integer not null,
  kg            numeric(6,1) not null default 0,
  reps          integer not null default 0,
  rpe           numeric(3,1),
  e1rm          numeric(6,1),                         -- Epley tahmini 1RM
  done_at       timestamptz,
  primary key (workout_id, exercise_id, set_no)
);
create index if not exists workout_sets_user_ex on public.workout_sets (user_id, exercise_id, day);

-- ---------------------------------------------------------------
-- 5) Uygulama durumu: profil, program, öğün planı, menüler, müzik listeleri (tek satır / kullanıcı)
-- ---------------------------------------------------------------
create table if not exists public.app_state (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 6) Yapay zekâ kullanımı (Edge Function yazar; kullanıcı yalnızca kendi satırını okur)
-- ---------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id           uuid not null references auth.users(id) on delete cascade,
  day               date not null,
  calls             integer not null default 0,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  provider          text,
  updated_at        timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists "own usage" on public.ai_usage;
create policy "own usage" on public.ai_usage for select to authenticated using (auth.uid() = user_id);
grant select on public.ai_usage to authenticated;

-- updated_at tetikleyicileri
do $$
declare t text;
begin
  foreach t in array array['food_entries','weights','workouts','app_state','ai_usage'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- Güvenlik: herkes yalnızca kendi satırlarını görür/yazar (RLS)
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['food_entries','weights','workouts','workout_sets','app_state'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.food_entries, public.weights, public.workouts, public.workout_sets, public.app_state to authenticated;

-- ---------------------------------------------------------------
-- Görünümler (security_invoker: RLS görünümde de geçerli)
-- ---------------------------------------------------------------
-- Günlük beslenme toplamı
create or replace view public.daily_nutrition with (security_invoker = true) as
select user_id, day,
       count(*)            as items,
       round(sum(kcal))    as kcal,
       round(sum(protein)) as protein,
       round(sum(carb))    as carb,
       round(sum(fat))     as fat
from public.food_entries
group by user_id, day;

-- Hareket bazında ilerleme: her antrenman gününde en iyi set ve tahmini 1RM
create or replace view public.exercise_progress with (security_invoker = true) as
select user_id, exercise_id, exercise_name, day,
       max(kg)                    as max_kg,
       max(e1rm)                  as best_e1rm,
       sum(kg * reps)             as volume,
       count(*)                   as sets
from public.workout_sets
group by user_id, exercise_id, exercise_name, day;

-- Haftalık hacim ve antrenman sayısı
create or replace view public.weekly_volume with (security_invoker = true) as
select user_id,
       date_trunc('week', day)::date as week_start,
       count(*)                      as workouts,
       round(sum(volume))            as volume,
       sum(sets)                     as sets,
       round(sum(seconds) / 60.0)    as minutes
from public.workouts
group by user_id, date_trunc('week', day);

-- Kişisel rekorlar (hareket başına en yüksek tahmini 1RM ve ne zaman)
create or replace view public.personal_records with (security_invoker = true) as
select distinct on (user_id, exercise_id)
       user_id, exercise_id, exercise_name, day, kg, reps, e1rm
from public.workout_sets
order by user_id, exercise_id, e1rm desc nulls last, day desc;

grant select on public.daily_nutrition, public.exercise_progress, public.weekly_volume, public.personal_records to authenticated;

-- Örnek sorgular (SQL Editor'de giriş yapmış kullanıcı yerine çalıştırırken user_id filtresi ekle):
--   select * from daily_nutrition where user_id = '<uuid>' order by day desc limit 14;
--   select * from exercise_progress where exercise_id = 'bench' order by day;
--   select * from personal_records order by e1rm desc;
--   select week_start, volume, workouts from weekly_volume order by week_start desc;
