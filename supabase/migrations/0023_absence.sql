-- =====================================================================
-- Migration 0023 - Absences longues (arret maladie, conges...) par plage
-- Une absence = personne + motif + date_debut..date_fin. Elle est
-- "materialisee" en placements (un par jour, avec motif_absence_id) pour
-- apparaitre directement dans le planning. Les placements crees portent
-- absence_id : supprimer l'absence supprime ses placements (cascade).
-- A executer dans le SQL Editor du projet Supabase.
-- =====================================================================

create table if not exists public.absence (
  id               uuid primary key default gen_random_uuid(),
  personne_id      uuid not null references public.personne (id) on delete cascade,
  motif_absence_id uuid references public.motif_absence (id) on delete set null,
  date_debut       date not null,
  date_fin         date not null,
  commentaire      text,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists absence_personne_idx on public.absence (personne_id, date_debut);

-- Lien placement -> absence (placements materialises). Cascade a la suppression.
alter table public.placement
  add column if not exists absence_id uuid references public.absence (id) on delete cascade;

-- ------------------------------------------------------------------
-- RLS : lecture authentifiee, ecriture admin OU chef de l'equipe.
-- ------------------------------------------------------------------
alter table public.absence enable row level security;
drop policy if exists absence_select on public.absence;
create policy absence_select on public.absence for select to authenticated using (true);
drop policy if exists absence_modify on public.absence;
create policy absence_modify on public.absence for all to authenticated
  using (public.can_edit_personne(personne_id))
  with check (public.can_edit_personne(personne_id));

-- ------------------------------------------------------------------
-- Triggers updated_at + audit
-- ------------------------------------------------------------------
drop trigger if exists set_updated_at_absence on public.absence;
create trigger set_updated_at_absence before update on public.absence
  for each row execute function public.set_updated_at();
drop trigger if exists audit_absence on public.absence;
create trigger audit_absence after insert or update or delete on public.absence
  for each row execute function public.audit_trigger();
