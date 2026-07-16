-- =====================================================================
-- 0032 : numero de rotation du poste, habilitations requises par poste,
--        tracabilite du forcage de placement.
-- =====================================================================

-- 1. Numero de rotation, saisi dans le Referentiel a cote du N° d'affichage.
--    Texte libre : un poste a effectif > 1 couvre plusieurs positions et
--    porte donc plusieurs numeros (ex. « 12, 13 » ou « 12-14 »).
alter table public.poste add column if not exists numero_rotation text;

-- 2. Habilitations exigees par un poste (ex. TPE pour les rangements).
--    Simple liaison : la presence d'une ligne = l'habilitation est requise.
create table if not exists public.poste_competence_requise (
  poste_id      uuid not null references public.poste (id) on delete cascade,
  competence_id uuid not null references public.competence (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (poste_id, competence_id)
);
create index if not exists pcr_competence_idx on public.poste_competence_requise (competence_id);

alter table public.poste_competence_requise enable row level security;
drop policy if exists pcr_select on public.poste_competence_requise;
create policy pcr_select on public.poste_competence_requise
  for select to authenticated using (true);
drop policy if exists pcr_modify on public.poste_competence_requise;
create policy pcr_modify on public.poste_competence_requise
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3. Forcage : placer une personne sur un poste dont il lui manque une
--    habilitation. On trace qui a force et quand ; le rouge a l'ecran reste
--    calcule sur l'etat courant des habilitations (il s'efface apres
--    regularisation), le drapeau ne sert qu'a l'audit.
alter table public.placement
  add column if not exists forcage_habilitation boolean not null default false,
  add column if not exists forcage_auteur_app_user_id uuid,
  add column if not exists forcage_le timestamptz;
