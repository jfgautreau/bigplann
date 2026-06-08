-- =====================================================================
-- Migration 0019 - Semaine type : ouverture des lignes par defaut.
-- Complete 0018 (quarts actifs) avec un gabarit d'ouverture des lignes
-- par (quart, ligne, jour de semaine). Absence de ligne = OUVERT.
-- A executer dans le SQL Editor APRES 0018.
-- jour_semaine : 0 = lundi ... 6 = dimanche.
-- =====================================================================

create table if not exists public.semaine_type_ouverture (
  quart_code   text not null references public.quart (code) on delete cascade,
  ligne_id     uuid not null references public.ligne (id) on delete cascade,
  jour_semaine smallint not null check (jour_semaine between 0 and 6),
  ouverte      boolean not null default true,
  primary key (quart_code, ligne_id, jour_semaine)
);

alter table public.semaine_type_ouverture enable row level security;
drop policy if exists semaine_type_ouverture_select on public.semaine_type_ouverture;
create policy semaine_type_ouverture_select on public.semaine_type_ouverture
  for select to authenticated using (true);
drop policy if exists semaine_type_ouverture_modify on public.semaine_type_ouverture;
create policy semaine_type_ouverture_modify on public.semaine_type_ouverture
  for all to authenticated
  using (public.is_admin() or public.has_role('ordo'))
  with check (public.is_admin() or public.has_role('ordo'));

-- Pas de reprise : absence de ligne = ouvert (comportement historique).
