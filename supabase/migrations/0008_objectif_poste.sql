-- =====================================================================
-- Migration 0008 - Objectif de polyvalence par poste
-- A executer dans le SQL Editor APRES 0007.
-- =====================================================================

-- Nombre cible de personnes competentes (niveau >= 2) sur le poste.
alter table public.poste
  add column if not exists objectif_polyvalence int not null default 0
  check (objectif_polyvalence >= 0);
