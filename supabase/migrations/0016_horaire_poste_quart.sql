-- =====================================================================
-- Migration 0016 - Horaires au POSTE par QUART et par jour de semaine.
-- Remplace l'ancien modele (poste x equipe x jour) par (poste x quart x jour).
-- L'horaire est une propriete du poste, distincte selon le quart (Matin /
-- Apres-midi / Nuit) et le jour (0 = lundi .. 6 = dimanche).
-- A executer dans le SQL Editor APRES 0015.
-- NB : l'ancienne saisie (par equipe) est abandonnee -> table recreee a vide.
-- =====================================================================

-- Corrige au passage l'accent du libelle du quart Apres-midi.
update public.quart set libelle = 'Après-midi' where code = 'apres_midi';

drop table if exists public.horaire_poste cascade;

create table public.horaire_poste (
  poste_id   uuid not null references public.poste (id) on delete cascade,
  quart_code text not null references public.quart (code),
  jour       int  not null check (jour between 0 and 6),
  debut      text,
  fin        text,
  primary key (poste_id, quart_code, jour)
);

alter table public.horaire_poste enable row level security;

drop policy if exists horaire_poste_select on public.horaire_poste;
create policy horaire_poste_select on public.horaire_poste
  for select to authenticated using (true);

drop policy if exists horaire_poste_modify on public.horaire_poste;
create policy horaire_poste_modify on public.horaire_poste
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
