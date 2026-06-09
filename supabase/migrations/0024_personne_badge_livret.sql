-- =====================================================================
-- Migration 0024 - Personnel : numero de badge, livret d'accueil, motif periode
-- A executer dans le SQL Editor du projet Supabase.
-- =====================================================================

alter table public.personne
  add column if not exists numero_badge        text,
  add column if not exists date_livret_accueil date;

-- Motif du contrat (raison de la periode : remplacement, surcroit, etc.)
alter table public.contrat_periode
  add column if not exists motif text;
