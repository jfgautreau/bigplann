-- =====================================================================
-- Migration 0028 - Profils de semaine type (ex. "Standard", "Été").
-- Le gabarit unique (0018/0019) devient un profil "Standard" par defaut.
-- A executer dans le SQL Editor APRES 0027.
-- =====================================================================

-- 1) Table des profils.
create table if not exists public.semaine_type_profil (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  par_defaut boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.semaine_type_profil enable row level security;
drop policy if exists stp_select on public.semaine_type_profil;
create policy stp_select on public.semaine_type_profil
  for select to authenticated using (true);
drop policy if exists stp_modify on public.semaine_type_profil;
create policy stp_modify on public.semaine_type_profil
  for all to authenticated
  using (public.is_admin() or public.has_role('ordo'))
  with check (public.is_admin() or public.has_role('ordo'));

-- 2) Profil "Standard" par defaut (si aucun profil).
insert into public.semaine_type_profil (nom, par_defaut)
select 'Standard', true
where not exists (select 1 from public.semaine_type_profil);

-- 3) Colonne profil_id sur les deux tables gabarit.
alter table public.semaine_type_quart     add column if not exists profil_id uuid references public.semaine_type_profil (id) on delete cascade;
alter table public.semaine_type_ouverture add column if not exists profil_id uuid references public.semaine_type_profil (id) on delete cascade;

-- 4) Reprise : rattache l'existant au profil par defaut.
update public.semaine_type_quart
   set profil_id = (select id from public.semaine_type_profil where par_defaut order by created_at limit 1)
 where profil_id is null;
update public.semaine_type_ouverture
   set profil_id = (select id from public.semaine_type_profil where par_defaut order by created_at limit 1)
 where profil_id is null;

alter table public.semaine_type_quart     alter column profil_id set not null;
alter table public.semaine_type_ouverture alter column profil_id set not null;

-- 5) Cles primaires recomposees avec le profil.
alter table public.semaine_type_quart     drop constraint if exists semaine_type_quart_pkey;
alter table public.semaine_type_quart     add primary key (profil_id, quart_code, jour_semaine);
alter table public.semaine_type_ouverture drop constraint if exists semaine_type_ouverture_pkey;
alter table public.semaine_type_ouverture add primary key (profil_id, quart_code, ligne_id, jour_semaine);
