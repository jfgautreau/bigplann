-- =====================================================================
-- Migration 0025 - Temps partiel (personne)
-- temps_partiel : actif ou non.
-- tp_type : 'JOURS'    -> certaines demi-journees non travaillees (sinon normal)
--           'HORAIRES' -> horaires specifiques par jour de semaine
-- tp_config (jsonb) :
--   JOURS    : { "off": { "1": ["matin","aprem"], "5": ["aprem"] } }  (1=lundi..7=dimanche)
--   HORAIRES : { "horaires": { "1": { "debut":"08:00", "fin":"12:00" } } }
-- A executer dans le SQL Editor du projet Supabase.
-- =====================================================================

alter table public.personne
  add column if not exists temps_partiel boolean not null default false,
  add column if not exists tp_type       text check (tp_type in ('JOURS', 'HORAIRES')),
  add column if not exists tp_config      jsonb;
