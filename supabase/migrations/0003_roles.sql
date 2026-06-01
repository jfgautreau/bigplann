-- =====================================================================
-- Migration 0003 - Liste officielle des roles
-- Nouvelle liste : codir, chef_equipe, ordo, rh, admin, planning
-- A executer dans le SQL Editor APRES 0002.
-- =====================================================================

-- 1) Remappe les anciennes valeurs vers la nouvelle liste.
update public.app_user set role = case role
  when 'direction'     then 'codir'
  when 'resp_planning' then 'planning'
  when 'ordonnancement' then 'ordo'
  when 'resp_prod'     then 'codir'   -- role supprime -> codir
  else role
end
where role in ('direction','resp_planning','ordonnancement','resp_prod');

-- 2) Remplace la contrainte de controle.
alter table public.app_user drop constraint if exists app_user_role_check;
alter table public.app_user add constraint app_user_role_check
  check (role in ('codir','chef_equipe','ordo','rh','admin','planning'));

-- 3) Nouveau role par defaut.
alter table public.app_user alter column role set default 'codir';

-- 4) Trigger de creation de profil : role par defaut 'codir'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_user (user_id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    'codir'
  )
  on conflict (user_id) do nothing;
  return new;
end; $$;

-- 5) Lecture du journal d'audit : admin + CODIR.
create or replace function public.can_read_audit()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.app_user
    where user_id = auth.uid() and is_active and role in ('admin','codir')
  );
$$;
