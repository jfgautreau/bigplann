-- =====================================================================
-- Migration 0017 - Historique des contrats (periodes) par personne
-- Une personne peut avoir plusieurs contrats successifs (intérim avec
-- interruptions, CDD renouvelés, passage intérim -> CDI, ...).
-- La table personne conserve un REFLET denormalise de la periode la plus
-- recente (type_contrat / agence_interim / date_debut / date_fin) pour ne
-- rien casser des filtres existants et de l'affichage en liste.
-- A executer dans le SQL Editor du projet Supabase.
-- =====================================================================

create table if not exists public.contrat_periode (
  id             uuid primary key default gen_random_uuid(),
  personne_id    uuid not null references public.personne (id) on delete cascade,
  type_contrat   text not null default 'CDI'
                 check (type_contrat in ('CDI','CDD','INTERIM')),
  agence_interim text,
  date_debut     date,
  date_fin       date,            -- null = en cours / indeterminee
  commentaire    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists contrat_periode_personne_idx
  on public.contrat_periode (personne_id, date_debut desc);

-- ------------------------------------------------------------------
-- Row Level Security : lecture pour tout authentifie, ecriture admin
-- (memes regles que la table personne).
-- ------------------------------------------------------------------
alter table public.contrat_periode enable row level security;

drop policy if exists contrat_periode_select on public.contrat_periode;
create policy contrat_periode_select
  on public.contrat_periode for select
  to authenticated
  using (true);

drop policy if exists contrat_periode_modify on public.contrat_periode;
create policy contrat_periode_modify
  on public.contrat_periode for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------
-- Triggers updated_at + audit (fonctions definies en 0002).
-- ------------------------------------------------------------------
drop trigger if exists set_updated_at_contrat_periode on public.contrat_periode;
create trigger set_updated_at_contrat_periode
  before update on public.contrat_periode
  for each row execute function public.set_updated_at();

drop trigger if exists audit_contrat_periode on public.contrat_periode;
create trigger audit_contrat_periode
  after insert or update or delete on public.contrat_periode
  for each row execute function public.audit_trigger();

-- ------------------------------------------------------------------
-- Reprise des donnees : une periode initiale par personne, a partir
-- des colonnes existantes. Idempotent (ne reinsere pas si deja present).
-- ------------------------------------------------------------------
insert into public.contrat_periode (personne_id, type_contrat, agence_interim, date_debut, date_fin)
select p.id, p.type_contrat, p.agence_interim, p.date_debut, p.date_fin
from public.personne p
where not exists (
  select 1 from public.contrat_periode cp where cp.personne_id = p.id
);
