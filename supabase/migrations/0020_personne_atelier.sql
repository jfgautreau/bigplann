-- =====================================================================
-- Migration 0020 - Affectation atelier du personnel.
-- Permet de filtrer la liste des personnes dans le planning selon l'atelier
-- selectionne. Filtre SOUPLE (non bloquant) : on peut toujours placer une
-- personne sur un poste d'un autre atelier.
-- A executer dans le SQL Editor APRES 0019.
-- =====================================================================

alter table public.personne
  add column if not exists atelier_id uuid references public.atelier (id) on delete set null;

create index if not exists personne_atelier_idx on public.personne (atelier_id);
