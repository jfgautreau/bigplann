-- =====================================================================
-- Migration 0005 - Planning : besoin (ordonnancement) + placement
-- A executer dans le SQL Editor APRES 0004.
-- =====================================================================

-- ------------------------------------------------------------------
-- Helper de role generique
-- ------------------------------------------------------------------
create or replace function public.has_role(r text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.app_user
    where user_id = auth.uid() and is_active and role = r
  );
$$;

-- ------------------------------------------------------------------
-- Saisie ordonnancement : ouverture des lignes par jour
-- ------------------------------------------------------------------
create table if not exists public.ligne_ouverture (
  jour       date not null,
  ligne_id   uuid not null references public.ligne (id) on delete cascade,
  ouverte    boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (jour, ligne_id)
);

-- Activation d'une equipe (ex. nuit) par jour
create table if not exists public.jour_equipe (
  jour       date not null,
  equipe_id  uuid not null references public.equipe (id) on delete cascade,
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (jour, equipe_id)
);

-- ------------------------------------------------------------------
-- Placement : 1 personne = 1 poste (ou absence) = 1 jour
-- ------------------------------------------------------------------
create table if not exists public.placement (
  id               uuid primary key default gen_random_uuid(),
  jour             date not null,
  personne_id      uuid not null references public.personne (id) on delete cascade,
  equipe_id        uuid references public.equipe (id) on delete set null,
  poste_id         uuid references public.poste (id) on delete set null,
  motif_absence_id uuid,                 -- FK ajoutee au Lot 6 (motifs)
  non_travaille    boolean not null default false,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (personne_id, jour)
);
create index if not exists placement_jour_idx on public.placement (jour);
create index if not exists placement_poste_jour_idx on public.placement (poste_id, jour);
create index if not exists placement_personne_idx on public.placement (personne_id);

-- updated_at + audit sur placement (les 2 tables a cle composite n'ont pas
-- de colonne id : pas de trigger d'audit generique dessus).
drop trigger if exists set_updated_at_placement on public.placement;
create trigger set_updated_at_placement before update on public.placement
  for each row execute function public.set_updated_at();
drop trigger if exists audit_placement on public.placement;
create trigger audit_placement after insert or update or delete on public.placement
  for each row execute function public.audit_trigger();

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------
-- Ouverture lignes / equipes-jour : lecture authentifiee, ecriture admin + ordo.
do $$
declare t text;
begin
  foreach t in array array['ligne_ouverture','jour_equipe'] loop
    execute format('alter table public.%1$s enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (true);', t);
    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format('create policy %1$s_modify on public.%1$s for all to authenticated
                    using (public.is_admin() or public.has_role(''ordo''))
                    with check (public.is_admin() or public.has_role(''ordo''));', t);
  end loop;
end $$;

-- Placement : lecture authentifiee, ecriture admin ou chef de l'equipe.
alter table public.placement enable row level security;
drop policy if exists placement_select on public.placement;
create policy placement_select on public.placement for select to authenticated using (true);
drop policy if exists placement_modify on public.placement;
create policy placement_modify on public.placement for all to authenticated
  using (public.can_edit_personne(personne_id))
  with check (public.can_edit_personne(personne_id));
