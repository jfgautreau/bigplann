-- =====================================================================
-- Migration 0015 - Couleur d'equipe (pour colorer le planning)
-- A executer dans le SQL Editor APRES 0014.
-- =====================================================================

alter table public.equipe add column if not exists couleur text not null default '#64748b';
