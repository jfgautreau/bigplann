-- =====================================================================
-- Migration 0012 - Horaires de travail (par poste, equipe, jour de semaine)
-- Modele hebdomadaire reutilisable (jour 0 = lundi .. 6 = dimanche).
-- A executer dans le SQL Editor APRES 0011.
-- =====================================================================

create table if not exists public.horaire_poste (
  poste_id  uuid not null references public.poste (id) on delete cascade,
  equipe_id uuid not null references public.equipe (id) on delete cascade,
  jour      int not null check (jour between 0 and 6),
  debut     text,
  fin       text,
  primary key (poste_id, equipe_id, jour)
);

alter table public.horaire_poste enable row level security;

drop policy if exists horaire_poste_select on public.horaire_poste;
create policy horaire_poste_select on public.horaire_poste
  for select to authenticated using (true);

drop policy if exists horaire_poste_modify on public.horaire_poste;
create policy horaire_poste_modify on public.horaire_poste
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
