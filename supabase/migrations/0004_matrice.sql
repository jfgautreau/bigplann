-- =====================================================================
-- Migration 0004 - Matrice de polyvalence + competences transverses
-- A executer dans le SQL Editor APRES 0003.
-- =====================================================================

-- ------------------------------------------------------------------
-- Echelle de niveaux parametrable (carre magique, cf. cahier 6.1)
-- ------------------------------------------------------------------
create table if not exists public.competence_niveau_libelle (
  niveau  int primary key check (niveau between 0 and 4),
  libelle text not null
);
insert into public.competence_niveau_libelle (niveau, libelle) values
  (0, 'Non forme'),
  (1, 'Connait les instructions et regles de securite du poste'),
  (2, 'Garantit le niveau de qualite standard'),
  (3, 'Garantit les temps standards ; peut expliquer et guider'),
  (4, 'A forme un operateur jusqu''au niveau 3 (maitrise complete)')
on conflict (niveau) do nothing;

-- ------------------------------------------------------------------
-- Helpers de perimetre (chef d'equipe)
-- ------------------------------------------------------------------
create or replace function public.is_chef_of_equipe(eq uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.equipe_chef
    where equipe_id = eq and app_user_id = auth.uid()
  );
$$;

-- Admin, OU chef de l'equipe de rattachement de la personne.
create or replace function public.can_edit_personne(p uuid)
returns boolean language sql security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.personne pe
    join public.equipe_chef ec on ec.equipe_id = pe.equipe_id
    where pe.id = p and ec.app_user_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------------
-- Matrice (personne x poste)
-- ------------------------------------------------------------------
create table if not exists public.matrice (
  id                 uuid primary key default gen_random_uuid(),
  personne_id        uuid not null references public.personne (id) on delete cascade,
  poste_id           uuid not null references public.poste (id) on delete cascade,
  niveau_actuel      int not null default 0 check (niveau_actuel between 0 and 4),
  niveau_cible       int not null default 0 check (niveau_cible between 0 and 4),
  commentaire        text,
  auteur_app_user_id uuid,
  date_maj           timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (personne_id, poste_id)
);
create index if not exists matrice_personne_idx on public.matrice (personne_id);
create index if not exists matrice_poste_idx on public.matrice (poste_id);

-- ------------------------------------------------------------------
-- Competences transverses ET habilitations (flag a_recycler)
-- ------------------------------------------------------------------
create table if not exists public.competence (
  id                 uuid primary key default gen_random_uuid(),
  nom                text not null,
  type               text not null default 'NIVEAU' check (type in ('NIVEAU','ACQUIS')),
  a_recycler         boolean not null default false,
  duree_validite_mois int,
  actif              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.personne_competence (
  id                 uuid primary key default gen_random_uuid(),
  personne_id        uuid not null references public.personne (id) on delete cascade,
  competence_id      uuid not null references public.competence (id) on delete cascade,
  niveau             int check (niveau between 0 and 4),
  acquis             boolean,
  date_obtention     date,
  date_expiration    date,
  auteur_app_user_id uuid,
  date_maj           timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (personne_id, competence_id)
);
create index if not exists pc_personne_idx on public.personne_competence (personne_id);
create index if not exists pc_competence_idx on public.personne_competence (competence_id);

-- ------------------------------------------------------------------
-- Triggers updated_at + audit
-- ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['matrice','competence','personne_competence'] loop
    execute format('drop trigger if exists set_updated_at_%1$s on public.%1$s;', t);
    execute format('create trigger set_updated_at_%1$s before update on public.%1$s
                    for each row execute function public.set_updated_at();', t);
    execute format('drop trigger if exists audit_%1$s on public.%1$s;', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.audit_trigger();', t);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------
-- Echelle + definitions de competences : lecture authentifiee, ecriture admin.
do $$
declare t text;
begin
  foreach t in array array['competence_niveau_libelle','competence'] loop
    execute format('alter table public.%1$s enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (true);', t);
    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format('create policy %1$s_modify on public.%1$s for all to authenticated
                    using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- Matrice + personne_competence : lecture authentifiee,
-- ecriture admin OU chef de l'equipe de la personne.
do $$
declare t text;
begin
  foreach t in array array['matrice','personne_competence'] loop
    execute format('alter table public.%1$s enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (true);', t);
    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format('create policy %1$s_modify on public.%1$s for all to authenticated
                    using (public.can_edit_personne(personne_id))
                    with check (public.can_edit_personne(personne_id));', t);
  end loop;
end $$;
