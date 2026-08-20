-- =====================================================================
-- Migration 0051 — parametre_affichage : PK site_id (multi-site)
--
-- La table etait un singleton (CHECK id = 1, PK id). Le multi-site
-- exige une ligne par site. On remplace la PK par site_id et on
-- supprime la colonne id devenue inutile.
--
-- A executer dans le SQL Editor APRES 0050.
-- =====================================================================

-- 1. Drop les contraintes du singleton
ALTER TABLE public.parametre_affichage
  DROP CONSTRAINT IF EXISTS parametre_affichage_pkey;
ALTER TABLE public.parametre_affichage
  DROP CONSTRAINT IF EXISTS parametre_affichage_id_check;

-- 2. Drop la colonne id (toujours = 1, plus de raison d'etre)
ALTER TABLE public.parametre_affichage
  DROP COLUMN IF EXISTS id;

-- 3. PK = site_id : une seule ligne par site, lookup direct
ALTER TABLE public.parametre_affichage
  ADD PRIMARY KEY (site_id);
