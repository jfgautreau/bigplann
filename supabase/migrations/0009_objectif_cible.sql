-- =====================================================================
-- Migration 0009 - Objectif distinct pour le niveau cible
-- A executer dans le SQL Editor APRES 0008.
-- objectif_polyvalence sert d'objectif "actuel" ; on ajoute l'objectif "cible".
-- =====================================================================

alter table public.poste
  add column if not exists objectif_cible int not null default 0
  check (objectif_cible >= 0);
