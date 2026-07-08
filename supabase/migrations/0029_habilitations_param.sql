-- =====================================================================
-- Migration 0029 - Paramétrage enrichi des habilitations / formations.
-- Modele : Categorie (reglementaire | interne) > Groupe > Formation.
-- "Autorisation de conduite sur site" = une DATE au niveau du suivi
-- personne (personne_competence).
-- A executer dans le SQL Editor APRES 0028. Aucune donnee injectee ici.
-- =====================================================================

-- Definition des formations (table competence, habilitations = a_recycler).
alter table public.competence add column if not exists categorie text;                         -- 'reglementaire' | 'interne'
alter table public.competence add column if not exists groupe text;                            -- famille (Conduite d'engin, Secours, Qualite...)
alter table public.competence add column if not exists a_autorisation_conduite boolean not null default false; -- la formation suit une autorisation de conduite ?
alter table public.competence add column if not exists ordre integer not null default 0;        -- ordre d'affichage

-- Suivi par personne : date d'autorisation de conduite sur site.
alter table public.personne_competence add column if not exists date_autorisation_conduite date;
