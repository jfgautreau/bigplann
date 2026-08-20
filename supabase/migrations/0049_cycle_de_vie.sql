-- =====================================================================
-- Migration 0049 - Cycle de vie du personnel
--
-- Refonte de `personne.statut` en RESULTANTE des dates d'arrivee / depart.
--
-- Aujourd'hui :
--   • statut ∈ ('ACTIF','PARTI'), toggle manuel dans /personnel ;
--   • date_debut / date_fin : reflets denormalises du contrat le plus recent ;
--   • date_depart_prevu (0039) : informatif, ne bascule rien tout seul.
--
-- Apres :
--   • statut ∈ ('A_VENIR','ACTIF','PARTI') : cache calcule automatiquement.
--     - A_VENIR  : today < date_arrivee
--     - ACTIF    : date_arrivee <= today AND (date_depart_prevu IS NULL OR
--                                             today <= date_depart_prevu)
--     - PARTI    : today > date_depart_prevu
--   • date_arrivee : date d'entree dans l'effectif (premiere fois). Distincte
--     du reflet date_debut (dernier contrat). Utilise pour anticiper une
--     embauche future : on cree la fiche, elle reste A_VENIR jusqu'au jour J.
--   • Une fonction SQL `statut_calcule(...)` sert d'unique source de verite ;
--     un trigger BEFORE INSERT/UPDATE sur `personne` la rappelle a chaque
--     modification de date_arrivee ou date_depart_prevu.
--
-- Les 12 requetes qui filtrent .eq("statut","ACTIF") continuent a fonctionner
-- inchangees. Le planning / placement AJOUTENT un filtre par dates pour etre
-- robustes meme si un cache est desynchronise (recalcul jour par jour cote
-- application, cf. lib/personne-statut.ts).
--
-- A executer dans le SQL Editor APRES 0048.
-- =====================================================================

-- 1. Colonne date_arrivee -----------------------------------------------
alter table public.personne
  add column if not exists date_arrivee date;

comment on column public.personne.date_arrivee is
  'Date d''entree initiale dans l''effectif. Distincte de date_debut '
  '(reflet du contrat le plus recent). Peut etre dans le futur : la personne '
  'reste A_VENIR jusqu''au jour J.';

-- Backfill : plus ancien contrat_periode.date_debut par personne.
update public.personne p
   set date_arrivee = q.min_debut
  from (
    select personne_id, min(date_debut) as min_debut
      from public.contrat_periode
     where date_debut is not null
     group by personne_id
  ) q
 where q.personne_id = p.id
   and p.date_arrivee is null;

-- Filet : les personnes sans aucun contrat (rare) prennent leur date_debut
-- si elle existe, sinon la date de creation. Aucune ne doit rester null pour
-- que le calcul de statut soit deterministe.
update public.personne
   set date_arrivee = coalesce(date_debut, created_at::date)
 where date_arrivee is null;

create index if not exists personne_date_arrivee_idx
  on public.personne (date_arrivee);

-- 2. Elargissement du CHECK statut --------------------------------------
alter table public.personne
  drop constraint if exists personne_statut_check;

alter table public.personne
  add constraint personne_statut_check
    check (statut in ('A_VENIR','ACTIF','PARTI'));

comment on column public.personne.statut is
  'Cache calcule automatiquement par le trigger statut_auto : '
  'A_VENIR (avant date_arrivee) / ACTIF (dans la fenetre) / PARTI '
  '(apres date_depart_prevu). Ne pas ecrire directement.';

-- 3. Fonction de calcul + trigger BEFORE INSERT/UPDATE ------------------
create or replace function public.statut_calcule(
  p_arrivee date,
  p_depart date
) returns text
language sql immutable as $$
  select case
    when p_arrivee is null then 'ACTIF'                   -- filet (jamais)
    when current_date < p_arrivee then 'A_VENIR'
    when p_depart is not null and current_date > p_depart then 'PARTI'
    else 'ACTIF'
  end
$$;

create or replace function public.statut_auto()
returns trigger
language plpgsql as $$
begin
  new.statut := public.statut_calcule(new.date_arrivee, new.date_depart_prevu);
  return new;
end
$$;

drop trigger if exists statut_auto_personne on public.personne;
create trigger statut_auto_personne
  before insert or update of date_arrivee, date_depart_prevu, statut
  on public.personne
  for each row execute function public.statut_auto();

-- 4. Rafraichir immediatement le cache pour toutes les lignes existantes
update public.personne
   set statut = public.statut_calcule(date_arrivee, date_depart_prevu);

-- 5. Bascule quotidienne du cache ---------------------------------------
-- Meme sans pg_cron, on peut appeler cette fonction depuis /api/cron ou
-- au chargement de /personnel. Elle ne fait rien si le cache est deja bon.
create or replace function public.rafraichir_statuts_personnes(p_site uuid default null)
returns integer
language plpgsql
security invoker as $$
declare
  n integer;
begin
  update public.personne
     set statut = public.statut_calcule(date_arrivee, date_depart_prevu)
   where (p_site is null or site_id = p_site)
     and statut is distinct from public.statut_calcule(date_arrivee, date_depart_prevu);
  get diagnostics n = row_count;
  return n;
end
$$;

comment on function public.rafraichir_statuts_personnes(uuid) is
  'Met a jour le cache statut des personnes dont le calcul a change depuis '
  'la derniere ecriture. Appelable au chargement d''un ecran ou par un cron. '
  'Idempotente, retourne le nombre de lignes touchees.';
