-- =====================================================================
-- Migration 0034 - Liste des agences d'interim (ecran « Param. RH »).
--
-- Jusqu'ici, l'agence etait saisie en texte libre sur chaque periode de
-- contrat (contrat_periode.agence_interim) : autant d'orthographes que de
-- saisies (« Adecco », « ADECCO », « adeco »), donc aucun regroupement
-- possible. On passe par une liste fermee, parametree dans Param. RH et
-- proposee en menu deroulant a la saisie d'un contrat.
--
-- La colonne contrat_periode.agence_interim reste du TEXTE (pas de cle
-- etrangere) : l'historique contient des valeurs libres qu'une contrainte
-- rejetterait, et une agence supprimee ne doit pas effacer le passe.
--
-- A executer dans le SQL Editor APRES 0033.
-- =====================================================================

create table if not exists public.agence_interim (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);

-- Une agence par nom (insensible a la casse) : c'est tout l'objet de la table.
create unique index if not exists agence_interim_nom_unique
  on public.agence_interim (lower(nom));

alter table public.agence_interim enable row level security;

drop policy if exists agence_interim_select on public.agence_interim;
create policy agence_interim_select on public.agence_interim
  for select to authenticated using (true);

drop policy if exists agence_interim_modify on public.agence_interim;
create policy agence_interim_modify on public.agence_interim
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Amorcage : on reprend les agences deja saisies en texte libre, dedoublonnees
-- sur la casse. La premiere orthographe rencontree fait foi ; le menage des
-- doublons approchants se fait ensuite a la main dans l'ecran.
insert into public.agence_interim (nom)
select distinct on (lower(trim(agence_interim))) trim(agence_interim)
from public.contrat_periode
where agence_interim is not null
  and trim(agence_interim) <> ''
order by lower(trim(agence_interim)), created_at
on conflict do nothing;
