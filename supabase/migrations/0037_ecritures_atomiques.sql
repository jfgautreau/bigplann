-- =====================================================================
-- Migration 0037 - Rendre indivisibles les deux sequences « effacer puis
--                  reecrire » qui pouvaient perdre des donnees en silence.
--
-- CONSTAT
-- Deux ecrans enchainent un DELETE puis un INSERT depuis l'application, en
-- deux requetes HTTP distinctes. Entre les deux, rien ne garantit que la
-- seconde aboutisse : coupure reseau, session expiree, violation de
-- contrainte. Le DELETE, lui, a deja eu lieu.
--
--   1. ROTATION DES EQUIPES (/admin/equipes). On efface toute la reference
--      d'une semaine, puis on reinsere les lignes saisies. Or la rotation des
--      semaines suivantes est CALCULEE a partir de la reference datee la plus
--      recente (cf. src/lib/rotation.ts) : perdre une reference decale
--      silencieusement tout le calendrier posterieur, et la donnee n'est pas
--      reconstituable.
--
--   2. MODIFICATION D'UNE ABSENCE (/api/absence, op=update). On supprime les
--      placements materialises puis on les recree aux nouvelles dates. En cas
--      d'echec, l'absence subsiste dans sa liste mais a disparu du planning :
--      deux ecrans qui se contredisent, sans message.
--      (op=save avait deja un rollback manuel — lequel peut echouer a son tour.)
--
-- PRINCIPE
-- Le corps d'une fonction PL/pgSQL s'execute dans la transaction de l'appelant :
-- si l'INSERT leve, le DELETE qui precede est annule. C'est tout ce qui manquait.
--
-- SECURITY INVOKER (le defaut, non declare) : les droits de l'appelant
-- s'appliquent inchanges. Appelee avec le client service_role, la fonction
-- contourne la RLS exactement comme le fait le code actuel ; appelee avec le
-- client de session, elle reste soumise a `can_edit_personne`. On ajoute
-- l'atomicite SANS toucher au modele d'autorisation.
--
-- A executer dans le SQL Editor APRES 0036.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. Reference de rotation d'une semaine, remplacee d'un bloc
--    p_rows : [{ "equipe_id": "...", "quart_code": "matin" }, ...]
--    Un tableau vide efface la reference de la semaine (comportement voulu :
--    retirer toutes les equipes revient a supprimer la reference).
-- ------------------------------------------------------------------
create or replace function public.set_rotation_reference(p_semaine date, p_rows jsonb)
returns integer
language plpgsql
as $$
declare
  v_n integer;
begin
  if p_semaine is null then
    raise exception 'Semaine manquante.';
  end if;

  delete from public.rotation_reference where semaine = p_semaine;

  insert into public.rotation_reference (semaine, equipe_id, quart_code)
  select p_semaine, (e->>'equipe_id')::uuid, e->>'quart_code'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ------------------------------------------------------------------
-- 2. Absences : creation et modification, materialisation comprise
--
-- La materialisation ecrase un placement existant du meme jour (une absence
-- prime sur une affectation), d'ou le ON CONFLICT qui remet a NULL le poste,
-- l'equipe et le quart — c'est le comportement actuel de l'upsert applicatif,
-- reproduit a l'identique.
--
-- Le garde-fou des 800 jours est ici AUSSI (il etait cote application, ou il
-- tronquait en silence) : la base refuse, elle ne rogne pas.
-- ------------------------------------------------------------------
create or replace function public.creer_absence(
  p_personne uuid,
  p_motif    uuid,
  p_debut    date,
  p_fin      date,
  p_commentaire text,
  p_auteur   uuid
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_fin < p_debut then
    raise exception 'La date de fin doit être après la date de début.';
  end if;
  if (p_fin - p_debut) > 800 then
    raise exception 'Absence de plus de 800 jours : à découper en plusieurs périodes.';
  end if;

  insert into public.absence (personne_id, motif_absence_id, date_debut, date_fin, commentaire, created_by)
  values (p_personne, p_motif, p_debut, p_fin, p_commentaire, p_auteur)
  returning id into v_id;

  insert into public.placement (personne_id, jour, motif_absence_id, absence_id, created_by, non_travaille)
  select p_personne, d::date, p_motif, v_id, p_auteur, false
  from generate_series(p_debut, p_fin, interval '1 day') d
  on conflict (personne_id, jour) do update set
    poste_id         = null,
    equipe_id        = null,
    quart_code       = null,
    numero_rotation  = null,
    non_travaille    = false,
    motif_absence_id = excluded.motif_absence_id,
    absence_id       = excluded.absence_id;

  return v_id;
end;
$$;

create or replace function public.maj_absence(
  p_id       uuid,
  p_motif    uuid,
  p_debut    date,
  p_fin      date,
  p_commentaire text,
  p_auteur   uuid
)
returns void
language plpgsql
as $$
declare
  v_personne uuid;
begin
  if p_fin < p_debut then
    raise exception 'La date de fin doit être après la date de début.';
  end if;
  if (p_fin - p_debut) > 800 then
    raise exception 'Absence de plus de 800 jours : à découper en plusieurs périodes.';
  end if;

  select personne_id into v_personne from public.absence where id = p_id;
  if v_personne is null then
    raise exception 'Absence introuvable.';
  end if;

  update public.absence
     set motif_absence_id = p_motif,
         date_debut       = p_debut,
         date_fin         = p_fin,
         commentaire      = p_commentaire
   where id = p_id;

  -- Les anciens jours disparaissent et les nouveaux apparaissent dans la MEME
  -- transaction : le planning ne peut plus se retrouver sans l'absence.
  delete from public.placement where absence_id = p_id;

  insert into public.placement (personne_id, jour, motif_absence_id, absence_id, created_by, non_travaille)
  select v_personne, d::date, p_motif, p_id, p_auteur, false
  from generate_series(p_debut, p_fin, interval '1 day') d
  on conflict (personne_id, jour) do update set
    poste_id         = null,
    equipe_id        = null,
    quart_code       = null,
    numero_rotation  = null,
    non_travaille    = false,
    motif_absence_id = excluded.motif_absence_id,
    absence_id       = excluded.absence_id;
end;
$$;

-- Ces fonctions sont appelees en RPC depuis l'application (PostgREST) : il faut
-- le droit d'execution. La RLS des tables reste le garde-fou, la fonction ne
-- l'ayant pas desactivee (SECURITY INVOKER).
grant execute on function public.set_rotation_reference(date, jsonb) to authenticated;
grant execute on function public.creer_absence(uuid, uuid, date, date, text, uuid) to authenticated;
grant execute on function public.maj_absence(uuid, uuid, date, date, text, uuid) to authenticated;
