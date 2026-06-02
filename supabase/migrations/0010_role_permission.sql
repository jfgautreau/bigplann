-- =====================================================================
-- Migration 0010 - Matrice des droits (role x module)
-- Pilote la visibilite des menus et l'acces aux pages cote application.
-- La RLS reste le garde-fou au niveau base (l'admin conserve tout).
-- A executer dans le SQL Editor APRES 0009.
-- =====================================================================

create table if not exists public.role_permission (
  role    text not null,
  module  text not null,
  niveau  text not null default 'none' check (niveau in ('none', 'read', 'write')),
  primary key (role, module)
);

alter table public.role_permission enable row level security;

drop policy if exists role_permission_select on public.role_permission;
create policy role_permission_select on public.role_permission
  for select to authenticated using (true);

drop policy if exists role_permission_modify on public.role_permission;
create policy role_permission_modify on public.role_permission
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Pas de seed : les valeurs par defaut sont fournies cote application
-- (lib/permissions.ts). Les lignes inserees ici surchargent ces defauts.
