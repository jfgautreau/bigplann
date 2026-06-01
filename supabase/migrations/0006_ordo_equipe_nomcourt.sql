-- =====================================================================
-- Migration 0006 - Code court des postes + ouverture lignes par equipe
-- A executer dans le SQL Editor APRES 0005.
-- =====================================================================

-- 1) Code court (abrege) du poste, parametrable dans le referentiel.
alter table public.poste add column if not exists nom_court text;

-- 2) Ouverture des lignes desormais par (jour, ligne, equipe).
--    Defaut OUVERT : une ligne est ouverte sauf si une ligne explicite ouverte=false.
--    (Table recréée car la cle primaire change ; donnees de test perdues.)
drop table if exists public.ligne_ouverture;
create table public.ligne_ouverture (
  jour       date not null,
  ligne_id   uuid not null references public.ligne (id) on delete cascade,
  equipe_id  uuid not null references public.equipe (id) on delete cascade,
  ouverte    boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (jour, ligne_id, equipe_id)
);

alter table public.ligne_ouverture enable row level security;
drop policy if exists ligne_ouverture_select on public.ligne_ouverture;
create policy ligne_ouverture_select on public.ligne_ouverture
  for select to authenticated using (true);
drop policy if exists ligne_ouverture_modify on public.ligne_ouverture;
create policy ligne_ouverture_modify on public.ligne_ouverture
  for all to authenticated
  using (public.is_admin() or public.has_role('ordo'))
  with check (public.is_admin() or public.has_role('ordo'));
