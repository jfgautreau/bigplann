-- =====================================================================
-- Migration 0044 - Fonctions SQL site-aware : parametre `p_site` optionnel
--
-- CONSTAT
-- Les 3 fonctions posees en 0043 §L (creer_absence, maj_absence,
-- set_rotation_reference) exigent `current_site_id()`. Quand l'app les
-- appelle avec `getAdminClient()` (service_role, cas des ecrans qui ont
-- le droit de tout modifier), auth.uid() est NULL → current_site_id()
-- renvoie NULL → la fonction leve « Contexte site introuvable ». C'est
-- ce qui s'est produit ce jour a la creation d'une absence depuis la
-- modale Personnel.
--
-- CORRECTION
-- On ajoute un parametre `p_site uuid default null` en fin de signature.
-- L'app le passe explicitement (via profile.siteId) et les fonctions
-- l'utilisent en priorite ; on retombe sur current_site_id() si non
-- fourni (retro-compatible avec les appels session).
--
-- SECURITE
-- Le `p_site` n'ouvre pas de faille : les fonctions restent SECURITY
-- INVOKER et la RLS filtre chaque lecture/ecriture. Meme si un client
-- passait `p_site` d'un autre site, la RLS refuserait toute ligne de ce
-- site (personne_id introuvable). Le p_site est un pointeur, pas une
-- autorisation.
--
-- A executer dans le SQL Editor APRES 0043.
-- =====================================================================

create or replace function public.set_rotation_reference(
  p_semaine date,
  p_rows    jsonb,
  p_site    uuid default null
)
returns integer
language plpgsql
as $$
declare
  v_n    integer;
  v_site uuid := coalesce(p_site, public.current_site_id());
begin
  if p_semaine is null then
    raise exception 'Semaine manquante.';
  end if;
  if v_site is null then
    raise exception 'Contexte site introuvable pour set_rotation_reference.';
  end if;

  delete from public.rotation_reference
   where semaine = p_semaine and site_id = v_site;

  insert into public.rotation_reference (semaine, equipe_id, quart_code, site_id)
  select p_semaine, (e->>'equipe_id')::uuid, e->>'quart_code', v_site
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.creer_absence(
  p_personne uuid,
  p_motif    uuid,
  p_debut    date,
  p_fin      date,
  p_commentaire text,
  p_auteur   uuid,
  p_site     uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_id   uuid;
  v_site uuid := coalesce(p_site, public.current_site_id());
begin
  if p_fin < p_debut then
    raise exception 'La date de fin doit être après la date de début.';
  end if;
  if (p_fin - p_debut) > 800 then
    raise exception 'Absence de plus de 800 jours : à découper en plusieurs périodes.';
  end if;
  if v_site is null then
    raise exception 'Contexte site introuvable pour creer_absence.';
  end if;

  insert into public.absence
    (personne_id, motif_absence_id, date_debut, date_fin, commentaire, created_by, site_id)
  values (p_personne, p_motif, p_debut, p_fin, p_commentaire, p_auteur, v_site)
  returning id into v_id;

  insert into public.placement
    (personne_id, jour, motif_absence_id, absence_id, created_by, non_travaille, site_id)
  select p_personne, d::date, p_motif, v_id, p_auteur, false, v_site
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
  p_auteur   uuid,
  p_site     uuid default null
)
returns void
language plpgsql
as $$
declare
  v_personne uuid;
  v_site     uuid := coalesce(p_site, public.current_site_id());
begin
  if p_fin < p_debut then
    raise exception 'La date de fin doit être après la date de début.';
  end if;
  if (p_fin - p_debut) > 800 then
    raise exception 'Absence de plus de 800 jours : à découper en plusieurs périodes.';
  end if;
  if v_site is null then
    raise exception 'Contexte site introuvable pour maj_absence.';
  end if;

  select personne_id into v_personne
    from public.absence
   where id = p_id and site_id = v_site;
  if v_personne is null then
    raise exception 'Absence introuvable pour ce site.';
  end if;

  update public.absence
     set motif_absence_id = p_motif,
         date_debut       = p_debut,
         date_fin         = p_fin,
         commentaire      = p_commentaire
   where id = p_id and site_id = v_site;

  delete from public.placement where absence_id = p_id and site_id = v_site;

  insert into public.placement
    (personne_id, jour, motif_absence_id, absence_id, created_by, non_travaille, site_id)
  select v_personne, d::date, p_motif, p_id, p_auteur, false, v_site
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

grant execute on function public.set_rotation_reference(date, jsonb, uuid) to authenticated;
grant execute on function public.creer_absence(uuid, uuid, date, date, text, uuid, uuid) to authenticated;
grant execute on function public.maj_absence(uuid, uuid, date, date, text, uuid, uuid) to authenticated;
