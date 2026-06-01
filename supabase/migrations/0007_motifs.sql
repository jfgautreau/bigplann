-- =====================================================================
-- Migration 0007 - Motifs d'absence (version simplifiee)
-- A executer dans le SQL Editor APRES 0006.
-- =====================================================================

create table if not exists public.motif_absence (
  id         uuid primary key default gen_random_uuid(),
  libelle    text not null,
  code_court text not null unique,
  couleur    text not null default '#e5e7eb',
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Motifs initiaux (cf. cahier 9.1)
insert into public.motif_absence (libelle, code_court, couleur) values
  ('Conge paye', 'CP', '#bfdbfe'),
  ('CP anciennete', 'CPA', '#93c5fd'),
  ('Conge en attente', 'CEA', '#fde68a'),
  ('Absence maladie', 'AM', '#fecaca'),
  ('RCR', 'RCR', '#c7d2fe'),
  ('ACR', 'ACR', '#ddd6fe'),
  ('Recup heures de nuit', 'RHN', '#a5b4fc'),
  ('REPA', 'REPA', '#bbf7d0'),
  ('Jour non travaille', 'JNT', '#e5e7eb'),
  ('ABNI', 'ABNI', '#fed7aa'),
  ('Arret 1 jour', 'A1J', '#fca5a5'),
  ('Arret 2 jours', 'A2J', '#f87171'),
  ('Arret 1 semaine', 'A1S', '#ef4444'),
  ('Fin de contrat', 'FDC', '#d1d5db'),
  ('Formation', 'FOR', '#99f6e4')
on conflict (code_court) do nothing;

-- Lien placement -> motif (la colonne existe depuis 0005)
alter table public.placement drop constraint if exists placement_motif_fk;
alter table public.placement
  add constraint placement_motif_fk
  foreign key (motif_absence_id) references public.motif_absence (id) on delete set null;

-- updated_at + audit
drop trigger if exists set_updated_at_motif_absence on public.motif_absence;
create trigger set_updated_at_motif_absence before update on public.motif_absence
  for each row execute function public.set_updated_at();
drop trigger if exists audit_motif_absence on public.motif_absence;
create trigger audit_motif_absence after insert or update or delete on public.motif_absence
  for each row execute function public.audit_trigger();

-- RLS : lecture authentifiee, ecriture admin
alter table public.motif_absence enable row level security;
drop policy if exists motif_absence_select on public.motif_absence;
create policy motif_absence_select on public.motif_absence for select to authenticated using (true);
drop policy if exists motif_absence_modify on public.motif_absence;
create policy motif_absence_modify on public.motif_absence for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
