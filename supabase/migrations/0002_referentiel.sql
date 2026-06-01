-- =====================================================================
-- Migration 0002 - Referentiel structurel + personnel + audit
-- A executer dans le SQL Editor du projet Supabase APRES 0001_init.sql.
-- =====================================================================

-- ------------------------------------------------------------------
-- Utilitaires
-- ------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

-- Lecture du journal d'audit : admin + responsable production (cf. cahier 4).
create or replace function public.can_read_audit()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.app_user
    where user_id = auth.uid() and is_active and role in ('admin','resp_prod')
  );
$$;

-- ------------------------------------------------------------------
-- Journal d'audit
-- ------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  app_user_id uuid,
  action      text not null,          -- INSERT | UPDATE | DELETE
  table_name  text not null,
  record_id   text,
  old_values  jsonb,
  new_values  jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_table_idx on public.audit_log (table_name, created_at desc);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_id text;
begin
  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old); v_new := null; v_id := (old).id::text;
  elsif (tg_op = 'UPDATE') then
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_id := (new).id::text;
  else
    v_old := null; v_new := to_jsonb(new); v_id := (new).id::text;
  end if;

  insert into public.audit_log (app_user_id, action, table_name, record_id, old_values, new_values)
  values (auth.uid(), tg_op, tg_table_name, v_id, v_old, v_new);

  if (tg_op = 'DELETE') then return old; else return new; end if;
end; $$;

-- ------------------------------------------------------------------
-- Tables du referentiel
-- ------------------------------------------------------------------
create table if not exists public.atelier (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ligne (
  id         uuid primary key default gen_random_uuid(),
  atelier_id uuid not null references public.atelier (id) on delete cascade,
  nom        text not null,
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ligne_atelier_idx on public.ligne (atelier_id);

create table if not exists public.poste (
  id                  uuid primary key default gen_random_uuid(),
  ligne_id            uuid not null references public.ligne (id) on delete cascade,
  nom                 text not null,
  est_conducteur      boolean not null default false,
  effectif_requis     int not null default 0 check (effectif_requis >= 0),  -- abaque
  difficulte_formation int check (difficulte_formation between 1 and 3),
  niveau_min_requis   int not null default 0 check (niveau_min_requis between 0 and 4),
  actif               boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists poste_ligne_idx on public.poste (ligne_id);

create table if not exists public.equipe (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipe_chef (
  id           uuid primary key default gen_random_uuid(),
  equipe_id    uuid not null references public.equipe (id) on delete cascade,
  app_user_id  uuid not null references public.app_user (user_id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (equipe_id, app_user_id)
);

create table if not exists public.personne (
  id            uuid primary key default gen_random_uuid(),
  matricule     text unique,                 -- nullable : auto-genere si interim sans matricule
  nom           text not null,
  prenom        text not null,
  equipe_id     uuid references public.equipe (id) on delete set null,  -- rattachement
  type_contrat  text not null default 'CDI' check (type_contrat in ('CDI','CDD','INTERIM')),
  agence_interim text,
  date_debut    date,
  date_fin      date,
  commentaire   text,                         -- PAS d'info medicale
  statut        text not null default 'ACTIF' check (statut in ('ACTIF','PARTI')),
  anonymise     boolean not null default false,
  anonymise_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists personne_equipe_idx on public.personne (equipe_id);
create index if not exists personne_statut_idx on public.personne (statut);

-- ------------------------------------------------------------------
-- Triggers updated_at + audit
-- ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['atelier','ligne','poste','equipe','personne'] loop
    execute format('drop trigger if exists set_updated_at_%1$s on public.%1$s;', t);
    execute format('create trigger set_updated_at_%1$s before update on public.%1$s
                    for each row execute function public.set_updated_at();', t);
  end loop;

  foreach t in array array['atelier','ligne','poste','equipe','equipe_chef','personne'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s;', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.audit_trigger();', t);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- Row Level Security
--   Lecture : tout authentifie. Ecriture : admin uniquement (is_admin()).
--   (Le perimetre "chef d'equipe" sera ajoute avec le module Planning.)
-- ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['atelier','ligne','poste','equipe','equipe_chef','personne'] loop
    execute format('alter table public.%1$s enable row level security;', t);

    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (true);', t);

    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format('create policy %1$s_modify on public.%1$s for all to authenticated
                    using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- Audit : lecture restreinte, aucune ecriture cliente (le trigger SECURITY DEFINER ecrit).
alter table public.audit_log enable row level security;
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.can_read_audit());
