-- =====================================================================
-- Migration 0050 - Contrats comme source de verite du cycle de vie
--
-- Constat : les champs `personne.date_arrivee` (0049), `date_depart_prevu`
-- (0039) et `motif_depart` (0039) doublonnent MIN/MAX(contrat_periode).
-- Aujourd'hui on saisit deux fois la meme chose : la date d'arrivee ET
-- la date de debut du premier contrat, souvent identiques.
--
-- Apres cette migration :
--   • date_arrivee    = MIN(contrat_periode.date_debut) — calculee.
--   • date_depart_prevu = MAX(contrat_periode.date_fin), null si un contrat
--     est encore ouvert (CDI sans date de fin) — calculee.
--   • motif_depart    -> demenage sur contrat_periode.motif_fin (motif de
--     fin du contrat concerne). Le "motif de depart" effectif est le
--     motif_fin du dernier contrat ferme.
--
-- Le champ `personne.statut` reste stocke comme cache (les 12 requetes
-- .eq("statut","ACTIF") en dependent), mais il est desormais maintenu par
-- un trigger sur `contrat_periode`, plus par celui sur `personne`.
--
-- A executer dans le SQL Editor APRES 0049.
-- =====================================================================

-- 1. Nouvelle colonne motif_fin sur contrat_periode -------------------
alter table public.contrat_periode
  add column if not exists motif_fin text;

comment on column public.contrat_periode.motif_fin is
  'Motif de fin de ce contrat (retraite, demission, fin de mission, '
  'non-renouvellement...). Le motif_fin du contrat le plus recent tient '
  'lieu de « motif de depart » de la personne.';

-- 2. Backfill : personne.motif_depart -> motif_fin du dernier contrat
update public.contrat_periode cp
   set motif_fin = p.motif_depart
  from public.personne p
 where p.id = cp.personne_id
   and p.motif_depart is not null
   and cp.motif_fin is null
   and cp.id = (
     select cp2.id
       from public.contrat_periode cp2
      where cp2.personne_id = p.id
      order by cp2.date_debut desc nulls last, cp2.created_at desc
      limit 1
   );

-- 3. Nouvelles fonctions de calcul ------------------------------------
-- Dates derivees d'une personne (a partir de ses contrats).
create or replace function public.personne_arrivee_depart(p_personne uuid)
returns table(arrivee date, depart date)
language sql stable security invoker as $$
  select
    min(date_debut) as arrivee,
    -- Depart = MAX(date_fin) UNIQUEMENT si aucun contrat ouvert (CDI sans
    -- date de fin). Sinon la personne reste indefiniment ACTIF.
    case
      when bool_or(date_fin is null and date_debut is not null) then null
      else max(date_fin)
    end as depart
  from public.contrat_periode
  where personne_id = p_personne
    and date_debut is not null
$$;

-- Statut calcule d'une personne : combine arrivee/depart via statut_calcule
-- (fonction 0049, inchangee).
create or replace function public.personne_statut_calcule(p_personne uuid)
returns text
language sql stable security invoker as $$
  select public.statut_calcule(a.arrivee, a.depart)
    from public.personne_arrivee_depart(p_personne) a
$$;

-- 4. Nouveau trigger sur contrat_periode ------------------------------
-- A chaque insert/update/delete de contrat, on recalcule le statut de la
-- personne. `security definer` : le trigger doit pouvoir ecrire sur
-- personne meme si l'auteur du contrat n'a pas les droits d'ecriture
-- directs sur personne (cas d'un chef d'equipe qui peut editer son
-- perimetre mais pas toutes les personnes).
create or replace function public.sync_personne_statut_from_contrats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_statut text;
begin
  v_pid := coalesce(new.personne_id, old.personne_id);
  if v_pid is null then return coalesce(new, old); end if;
  select public.personne_statut_calcule(v_pid) into v_statut;
  update public.personne set statut = v_statut where id = v_pid;
  return coalesce(new, old);
end
$$;

drop trigger if exists sync_statut_from_contrats on public.contrat_periode;
create trigger sync_statut_from_contrats
  after insert or update or delete on public.contrat_periode
  for each row execute function public.sync_personne_statut_from_contrats();

-- 5. Retrait de l'ancien trigger sur personne -------------------------
-- Il basait le statut sur date_arrivee/date_depart_prevu qui disparaissent.
drop trigger if exists statut_auto_personne on public.personne;
drop function if exists public.statut_auto();

-- 6. rafraichir_statuts_personnes lit maintenant les contrats ---------
create or replace function public.rafraichir_statuts_personnes(p_site uuid default null)
returns integer
language plpgsql
security invoker as $$
declare
  n integer;
begin
  update public.personne p
     set statut = public.personne_statut_calcule(p.id)
   where (p_site is null or p.site_id = p_site)
     and p.statut is distinct from public.personne_statut_calcule(p.id);
  get diagnostics n = row_count;
  return n;
end
$$;

-- 7. Rafraichir immediatement le cache statut de toutes les lignes ----
update public.personne p
   set statut = public.personne_statut_calcule(p.id);

-- 8. Suppression des colonnes doublons --------------------------------
-- IMPORTANT : etape irreversible. Le backfill de motif_fin (etape 2)
-- doit avoir fonctionne pour ne pas perdre l'info « motif de depart ».
alter table public.personne drop column if exists date_arrivee;
alter table public.personne drop column if exists date_depart_prevu;
alter table public.personne drop column if exists motif_depart;

-- L'index qui portait sur date_arrivee / date_depart_prevu tombe avec la
-- colonne. Le CHECK statut (0049) reste en place, inchange.
