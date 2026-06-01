-- =====================================================================
-- Migration 0001 - Socle authentification / profils utilisateurs
-- Stack : Supabase (Auth + Postgres + RLS).
-- A executer dans le SQL Editor du projet Supabase (ou via la CLI).
-- =====================================================================

-- Profil applicatif lie a un compte Supabase Auth (auth.users).
create table if not exists public.app_user (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text not null default '',
  role       text not null default 'direction'
             check (role in ('admin','resp_prod','resp_planning',
                             'chef_equipe','ordonnancement','rh','direction')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Fonction utilitaire : l'appelant courant est-il admin ?
-- SECURITY DEFINER => ne declenche pas la RLS (evite la recursion
-- d'une policy sur app_user qui interrogerait app_user).
-- ------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_user
    where user_id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------
alter table public.app_user enable row level security;

-- Lecture : tout utilisateur authentifie voit tous les profils
-- (cf. cahier 3.2 : tous les roles voient les donnees en lecture).
drop policy if exists app_user_select on public.app_user;
create policy app_user_select
  on public.app_user for select
  to authenticated
  using (true);

-- Ecriture : reservee aux admins (les invitations passent par le
-- service_role cote serveur, qui bypass la RLS de toute facon).
drop policy if exists app_user_modify on public.app_user;
create policy app_user_modify
  on public.app_user for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------
-- Trigger : creation automatique du profil a l'inscription d'un compte.
-- Role par defaut = 'direction' (lecture seule) -> moindre privilege.
-- Un admin promeut ensuite au role voulu.
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_user (user_id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    'direction'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- BOOTSTRAP DU PREMIER ADMIN (a faire une seule fois, manuellement) :
--
--   1. Cree le premier utilisateur (Dashboard Supabase > Authentication
--      > Add user, ou via la page /login apres un signup).
--   2. Promeus-le admin :
--        update public.app_user set role = 'admin'
--        where email = 'ton.email@exemple.fr';
-- =====================================================================
