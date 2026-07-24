-- =====================================================================
-- Migration 0042 - Rôles personnalisés (créés depuis l'écran Utilisateurs)
--
-- Jusqu'ici la liste des rôles était figée dans le code (src/lib/roles.ts) et
-- verrouillée par un CHECK sur `app_user.role`. On permet d'AJOUTER des rôles
-- depuis l'écran Utilisateurs : ils apparaissent dans la matrice des droits
-- (aucun droit par défaut) et deviennent assignables aux comptes.
--
-- Sécurité : un rôle nouveau naît SANS aucun droit (defaultsFor renvoie « none »
-- pour tout code inconnu). Les garde-fous anti-escalade (droitsCouvertsPar,
-- verifierChangementDroit) se calculent sur la matrice, sans nom de rôle en dur :
-- ils s'appliquent donc automatiquement aux rôles personnalisés. Promouvoir
-- quelqu'un vers un rôle sans droit n'est jamais une escalade.
--
-- A exécuter dans le SQL Editor APRÈS 0041.
-- =====================================================================

-- 1) Table des rôles personnalisés (en plus des rôles intégrés du code).
create table if not exists public.role_custom (
  code       text primary key,
  libelle    text not null,
  created_at timestamptz not null default now()
);

-- Un libellé unique (insensible à la casse) : on ne crée pas deux fois le même.
create unique index if not exists role_custom_libelle_unique
  on public.role_custom (lower(libelle));

alter table public.role_custom enable row level security;

drop policy if exists role_custom_select on public.role_custom;
create policy role_custom_select on public.role_custom
  for select to authenticated using (true);

drop policy if exists role_custom_modify on public.role_custom;
create policy role_custom_modify on public.role_custom
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 2) On retire le CHECK figeant les rôles : un code personnalisé doit pouvoir
--    être stocké sur un compte. La validation passe désormais côté application
--    (liste des rôles intégrés + role_custom).
alter table public.app_user drop constraint if exists app_user_role_check;
