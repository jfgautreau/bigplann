-- =====================================================================
-- Migration 0022 - Sexe (H/F) de la personne
-- Colonne optionnelle : 'H' (Homme) ou 'F' (Femme), null si non renseigne.
-- A executer dans le SQL Editor du projet Supabase.
-- =====================================================================

alter table public.personne
  add column if not exists sexe text check (sexe in ('H', 'F'));
