-- =====================================================================
-- Migration 0041 - Lever les CHECK type_contrat in ('CDI','CDD','INTERIM')
--
-- Les migrations 0002 (personne) et 0017 (contrat_periode) posaient une
-- contrainte CHECK figeant les 3 codes autorises. Depuis la 0040, ces codes
-- sont saisis dans la table `type_contrat` (ecran Param. RH) : ajouter
-- « STAGIAIRE », « ALTERNANCE » ou tout autre code passe par cette table.
-- La contrainte CHECK, elle, restait sur les deux tables et refusait toute
-- valeur hors des 3 originales.
--
-- On lit uniquement dans l'application (dropdown liste les codes actifs). Un
-- verrou de coherence pourrait etre remis via une FK vers type_contrat.code,
-- mais l'historique porte deja des valeurs — 401 lignes en base — dont
-- certaines pourraient etre absentes de la nouvelle table. On garde donc
-- personne.type_contrat / contrat_periode.type_contrat en TEXTE libre.
--
-- A executer dans le SQL Editor APRES 0040.
-- =====================================================================

-- Les contraintes ont ete creees anonymement dans les migrations d'origine
-- (`text not null default 'CDI' check (...)`). Postgres leur donne le nom
-- `<table>_<colonne>_check`. On les drop en IF EXISTS pour rester idempotent.
alter table public.personne         drop constraint if exists personne_type_contrat_check;
alter table public.contrat_periode  drop constraint if exists contrat_periode_type_contrat_check;
