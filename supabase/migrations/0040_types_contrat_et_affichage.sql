-- =====================================================================
-- Migration 0040 - Types de contrat et fenetre d'affichage.
--
-- 1. Types de contrat parametrables (ecran « Param. RH »).
--    Jusqu'ici les valeurs CDI / CDD / INTERIM etaient ecrites en dur dans
--    l'application. On les sort dans une table dont l'ecran RH ecrit et lit,
--    pour permettre d'en ajouter (Alternance, Stage, Apprentissage...) sans
--    livrer une version. La colonne `personne.type_contrat` (et
--    `contrat_periode.type_contrat`) reste du TEXTE : l'historique porte les
--    codes existants, on les rattache par egalite de code, aucune FK a poser.
--
-- 2. Fenetre d'affichage du planning : nombre de jours avant/apres J.
--    Reglage global (une seule ligne, singleton) : cf. src/lib/parametres.ts.
--
-- A executer dans le SQL Editor APRES 0039.
-- =====================================================================

-- --- 1. Types de contrat -------------------------------------------------
create table if not exists public.type_contrat (
  code       text primary key,
  libelle    text not null,
  actif      boolean not null default true,
  ordre      integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.type_contrat enable row level security;

drop policy if exists type_contrat_select on public.type_contrat;
create policy type_contrat_select on public.type_contrat
  for select to authenticated using (true);

drop policy if exists type_contrat_modify on public.type_contrat;
create policy type_contrat_modify on public.type_contrat
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Amorcage : les 3 codes que l'application connaissait deja, dans l'ordre du
-- menu deroulant Personnel (CDI, CDD, Interim).
insert into public.type_contrat (code, libelle, ordre) values
  ('CDI',     'CDI',     1),
  ('CDD',     'CDD',     2),
  ('INTERIM', 'Intérim', 3)
on conflict (code) do nothing;

-- --- 2. Fenetre d'affichage du planning ---------------------------------
-- Une seule ligne (`id = 1`) : la contrainte CHECK verrouille le singleton.
create table if not exists public.parametre_affichage (
  id            integer primary key check (id = 1),
  jours_avant   integer not null default 1 check (jours_avant >= 0 and jours_avant <= 14),
  jours_apres   integer not null default 4 check (jours_apres >= 0 and jours_apres <= 30),
  updated_at    timestamptz not null default now()
);

alter table public.parametre_affichage enable row level security;

drop policy if exists parametre_affichage_select on public.parametre_affichage;
create policy parametre_affichage_select on public.parametre_affichage
  for select to authenticated using (true);

drop policy if exists parametre_affichage_modify on public.parametre_affichage;
create policy parametre_affichage_modify on public.parametre_affichage
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.parametre_affichage (id, jours_avant, jours_apres)
values (1, 1, 4)
on conflict (id) do nothing;
