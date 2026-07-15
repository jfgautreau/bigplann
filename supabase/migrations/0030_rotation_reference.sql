-- =====================================================================
-- Migration 0030 - Rotation des equipes par "reference datee".
--
-- Remplace la saisie semaine-par-semaine (equipe_quart_semaine) par une
-- "reference" : une semaine (lundi ISO) + le quart de chaque equipe tournante
-- cette semaine-la. L'alternance des semaines suivantes est calculee cote
-- application (rotation cyclique) et n'est jamais stockee. Le passe (semaines
-- anterieures a une reference) n'est jamais recalcule.
--
-- Plusieurs references datees coexistent : pour une semaine donnee, la
-- reference active est la plus recente dont la semaine est <= cette semaine.
-- Ainsi, changer la rotation = ajouter une nouvelle reference datee, sans
-- toucher le passe.
--
-- equipe_quart_semaine est CONSERVEE (historique brut) mais n'est plus lue ni
-- ecrite par l'application.
--
-- A executer dans le SQL Editor APRES 0029.
-- =====================================================================

create table if not exists public.rotation_reference (
  semaine    date not null,
  equipe_id  uuid not null references public.equipe (id) on delete cascade,
  quart_code text not null references public.quart (code),
  primary key (semaine, equipe_id)
);

-- RLS : lecture authentifiee ; ecriture admin ou ordo (comme equipe_quart_semaine).
alter table public.rotation_reference enable row level security;
drop policy if exists rotation_reference_select on public.rotation_reference;
create policy rotation_reference_select on public.rotation_reference
  for select to authenticated using (true);
drop policy if exists rotation_reference_modify on public.rotation_reference;
create policy rotation_reference_modify on public.rotation_reference
  for all to authenticated
  using (public.is_admin() or public.has_role('ordo'))
  with check (public.is_admin() or public.has_role('ordo'));
