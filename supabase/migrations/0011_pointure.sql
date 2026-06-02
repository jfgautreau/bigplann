-- =====================================================================
-- Migration 0011 - Pointure (chaussures de securite) sur le personnel
-- A executer dans le SQL Editor APRES 0010.
-- =====================================================================

alter table public.personne add column if not exists pointure text;
