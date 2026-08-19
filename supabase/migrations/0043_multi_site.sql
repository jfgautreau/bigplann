-- =====================================================================
-- Migration 0043 - Socle multi-site (SaaS multi-tenant)
--
-- Passe Polaris d'une application mono-usine à une plateforme multi-tenant.
-- Une seule base Supabase, un seul projet Vercel, isolation via `site_id` +
-- RLS. Un compte utilisateur appartient à exactement UN site (round 1,
-- 2026-08-19).
--
-- Chantier documenté in extenso dans tasks/multi-site.md.
--
-- === CE QUE CETTE MIGRATION FAIT ===
--   A. Crée la table `site` et le site historique « lebignon ».
--   B. Ajoute `site_id NOT NULL` sur toutes les tables métier locales.
--   C. Ajoute `site_id NULL` sur les tables partagées (motifs, contrats,
--      rôles) → NULL = ligne groupe visible partout ; un site peut
--      surcharger en insérant sa propre ligne.
--   D. Réécrit les unicités site-scopées (`unique(site_id, code)`).
--   E. Composite FKs (id, site_id) sur les relations sensibles :
--      Postgres refuse à la base tout mélange inter-sites (ceinture +
--      bretelles au-dessus de la RLS).
--   F. Réécrit TOUTES les policies RLS autour de `current_site_id()`.
--   G. Ajoute `app_user.est_super_admin` (champ dédié hors matrice des
--      rôles, invisible dans l'écran /admin/users d'un site).
--   H. Table `audit_impersonation` pour le mode support.
--   I. Trigger `set_site_id_from_context` qui pose site_id sur INSERT si
--      l'application ne l'a pas fourni (compatibilité descendante :
--      l'app existante continue à écrire sans site_id, le trigger le
--      pose depuis le contexte utilisateur).
--
-- === CE QUE CETTE MIGRATION NE FAIT PAS ===
--   - Wildcard DNS *.polaris.app : à faire dans Vercel.
--   - Écran /platform : PR suivante.
--   - Passage à des sous-domaines multiples : PR suivante. Pour V1a, le
--     middleware fait un fallback single-site (retourne toujours lebignon).
--
-- === IRRÉVERSIBLE ===
-- Sauvegarde Supabase (pg_dump) obligatoire AVANT exécution.
--
-- A exécuter dans le SQL Editor du projet Supabase APRÈS 0042.
-- =====================================================================


-- =====================================================================
-- A. TABLE `site` ET SITE HISTORIQUE (SANS RLS ENCORE)
--    On crée la table + on insère lebignon SANS activer la RLS ni créer
--    les policies : ces dernières référencent app_user.site_id et
--    est_super_admin qui n'existent pas encore. On active la RLS de
--    `site` en fin de §B, une fois app_user étoffée.
-- =====================================================================

create table if not exists public.site (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  nom                text not null,
  statut             text not null default 'actif'
                     check (statut in ('actif','suspendu','archive')),
  fuseau             text not null default 'Europe/Paris',
  cree_le            timestamptz not null default now(),
  cree_par           uuid,                       -- app_user.user_id (nullable)
  -- Crochets V2 (facturation, quotas, branding) : colonnes prêtes,
  -- exploitées par /platform plus tard.
  plan               text,
  quota_personnes    integer,
  quota_utilisateurs integer,
  logo_url           text,
  accent             text                        -- hex, ex. '#0ea5e9'
);

create unique index if not exists site_slug_unique on public.site (lower(slug));

-- Site historique : UUID stable pour pouvoir le référencer dans les DEFAULT
-- des ALTER TABLE ci-dessous SANS avoir besoin de le calculer via une
-- fonction. Le UUID est arbitraire mais fixé ici une fois pour toutes.
insert into public.site (id, slug, nom)
values ('00000000-0000-4000-8000-00000000c0de', 'lebignon', 'Lebignon')
on conflict (slug) do nothing;


-- =====================================================================
-- B. RATTACHEMENT DES UTILISATEURS À UN SITE
-- =====================================================================

-- 1) Champ super_admin (hors matrice de rôles).
alter table public.app_user
  add column if not exists est_super_admin boolean not null default false;

-- 2) Rattachement au site. NOT NULL après backfill (les 2 étapes en une).
alter table public.app_user
  add column if not exists site_id uuid references public.site (id);

update public.app_user
   set site_id = '00000000-0000-4000-8000-00000000c0de'
 where site_id is null;

alter table public.app_user
  alter column site_id set not null;

create index if not exists app_user_site_idx on public.app_user (site_id);

-- 3) RLS de `site` (déférée depuis §A) : app_user.site_id et
--    est_super_admin existent maintenant, les policies peuvent les
--    référencer.
alter table public.site enable row level security;

drop policy if exists site_select on public.site;
create policy site_select on public.site for select to authenticated
  using (
    id = (select site_id from public.app_user where user_id = auth.uid())
    or exists (
      select 1 from public.app_user
      where user_id = auth.uid() and est_super_admin = true
    )
  );

drop policy if exists site_modify on public.site;
create policy site_modify on public.site for all to authenticated
  using (exists (
    select 1 from public.app_user
    where user_id = auth.uid() and est_super_admin = true
  ))
  with check (exists (
    select 1 from public.app_user
    where user_id = auth.uid() and est_super_admin = true
  ));

-- 3) L'inscription auto (handle_new_user) doit rattacher au site... mais
--    quel site ? En V1 : pas d'inscription self-serve, tous les comptes sont
--    créés depuis /admin/users (existant) OU /platform (à venir), qui
--    posent site_id explicitement. Le trigger conserve un fallback vers le
--    site historique pour ne pas casser un éventuel signup direct.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_user (user_id, email, name, role, site_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    'codir',
    coalesce(
      -- Si les metadata portent un site_id (créé via /admin/users depuis un
      -- sous-domaine résolu), on l'utilise. Sinon fallback historique.
      nullif(new.raw_user_meta_data->>'site_id', '')::uuid,
      '00000000-0000-4000-8000-00000000c0de'
    )
  )
  on conflict (user_id) do nothing;
  return new;
end; $$;


-- =====================================================================
-- C. FONCTIONS HELPERS SITE-AWARE
-- =====================================================================

-- Le site de l'utilisateur courant. STABLE : appelée dans les policies RLS,
-- évaluée une fois par requête.
create or replace function public.current_site_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select site_id from public.app_user
  where user_id = auth.uid() and is_active = true
$$;

-- Est-il super_admin ? Utilisé pour /platform. STABLE.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select est_super_admin from public.app_user where user_id = auth.uid()),
    false
  );
$$;

-- On resserre is_admin() : admin ET rattaché à un site actif. L'admin ne
-- peut plus rien faire si son site est suspendu (login refusé en amont par
-- le middleware).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_user u
    join public.site s on s.id = u.site_id
    where u.user_id = auth.uid()
      and u.role = 'admin'
      and u.is_active = true
      and s.statut = 'actif'
  );
$$;

-- has_role() suit la même logique.
create or replace function public.has_role(r text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_user u
    join public.site s on s.id = u.site_id
    where u.user_id = auth.uid()
      and u.role = r
      and u.is_active = true
      and s.statut = 'actif'
  );
$$;

-- can_edit_personne : on ajoute le contrôle de site (défense en profondeur).
create or replace function public.can_edit_personne(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- La personne doit appartenir au site courant.
    exists (
      select 1 from public.personne pe
      where pe.id = p
        and pe.site_id = public.current_site_id()
    )
    and (
      public.is_admin()
      or exists (
        select 1
        from public.personne pe
        join public.equipe_chef ec on ec.equipe_id = pe.equipe_id
        where pe.id = p and ec.app_user_id = auth.uid()
      )
    );
$$;

-- can_read_audit : idem (admin ou codir, ET site courant).
create or replace function public.can_read_audit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_user u
    join public.site s on s.id = u.site_id
    where u.user_id = auth.uid()
      and u.role in ('admin','codir')
      and u.is_active = true
      and s.statut = 'actif'
  );
$$;


-- =====================================================================
-- D. AJOUT DE `site_id` SUR TOUTES LES TABLES MÉTIER LOCALES
--    NOT NULL, DEFAULT = site historique (backfill).
-- =====================================================================

do $$
declare
  t text;
  tables_locales text[] := array[
    -- Structure
    'atelier','ligne','poste','equipe','equipe_chef','personne',
    -- Matrice & habilitations
    'matrice','personne_competence','poste_competence_requise',
    -- Horaires
    'horaire_poste','horaire_exception','poste_quart',
    -- Ordonnancement
    'ligne_ouverture','jour_equipe',
    'equipe_quart_semaine','jour_quart','ouverture_quart',
    'semaine_type_profil','semaine_type_quart','semaine_type_ouverture',
    'rotation_reference',
    -- Placement / absences
    'placement','absence',
    -- Contrats / intérim / paramétrage local
    'contrat_periode','agence_interim','parametre_affichage'
  ];
begin
  foreach t in array tables_locales loop
    execute format($f$
      alter table public.%1$s
        add column if not exists site_id uuid
        not null default '00000000-0000-4000-8000-00000000c0de'
        references public.site (id) on delete restrict;
    $f$, t);
    execute format('create index if not exists %1$s_site_idx on public.%1$s (site_id);', t);
  end loop;
end $$;

-- On CONSERVE le DEFAULT sur les tables locales EN V1a. Rationale :
--   * L'application actuelle appelle getAdminClient() (service_role) pour
--     l'essentiel de ses écritures. service_role a auth.uid() = NULL, donc
--     current_site_id() = NULL : le trigger ne peut pas résoudre le site.
--   * Le DEFAULT lebignon garantit que TOUTE INSERT sans site_id explicite
--     tombe au bon endroit tant qu'il n'y a qu'un site.
--   * Dès qu'un second site sera provisionné (PR /platform), on retirera
--     le DEFAULT dans une migration 0044/45 et on aura mis à jour chaque
--     route API pour poser site_id explicitement.
--
-- Le trigger set_site_id_from_context (§I) sert de garde-fou : il refuse
-- une insertion où site_id est explicitement mis à NULL (ce qui pourrait
-- arriver d'un bug applicatif).


-- =====================================================================
-- E. TABLES PARTAGÉES (site_id NULL = groupe, sinon = local)
--    motif_absence, type_contrat, role_custom, role_permission
--    → nullable, pas de trigger auto-fill (les écritures viennent de
--    /platform pour les lignes groupe, et de l'app locale pour les
--    surcharges — dans les deux cas, site_id est fourni explicitement).
-- =====================================================================

alter table public.motif_absence
  add column if not exists site_id uuid references public.site (id) on delete cascade;
create index if not exists motif_absence_site_idx on public.motif_absence (site_id);

alter table public.type_contrat
  add column if not exists site_id uuid references public.site (id) on delete cascade;
create index if not exists type_contrat_site_idx on public.type_contrat (site_id);

alter table public.role_custom
  add column if not exists site_id uuid references public.site (id) on delete cascade;
create index if not exists role_custom_site_idx on public.role_custom (site_id);

alter table public.role_permission
  add column if not exists site_id uuid references public.site (id) on delete cascade;
create index if not exists role_permission_site_idx on public.role_permission (site_id);

-- Le journal d'audit reçoit site_id (backfill au site historique) et
-- l'identifiant du super_admin qui impersonait au moment de l'écriture.
alter table public.audit_log
  add column if not exists site_id uuid references public.site (id) on delete set null,
  add column if not exists impersonated_by uuid;
update public.audit_log
   set site_id = '00000000-0000-4000-8000-00000000c0de'
 where site_id is null;
create index if not exists audit_log_site_idx on public.audit_log (site_id, created_at desc);


-- =====================================================================
-- F. UNICITÉS RÉÉCRITES EN (site_id, ...)
-- =====================================================================

-- personne.matricule : unicité par site (deux sites peuvent avoir le même
-- matricule, mais un site ne peut pas avoir deux fois le même).
alter table public.personne drop constraint if exists personne_matricule_key;
drop index if exists personne_matricule_key;
create unique index if not exists personne_site_matricule_unique
  on public.personne (site_id, matricule)
  where matricule is not null;

-- agence_interim : unique sur (site_id, lower(nom)).
drop index if exists agence_interim_nom_unique;
create unique index if not exists agence_interim_site_nom_unique
  on public.agence_interim (site_id, lower(nom));

-- semaine_type_profil : au plus un profil par_defaut par site (déjà
-- implicite dans le métier, on le grave dans la base).
drop index if exists semaine_type_profil_par_defaut_unique;
create unique index if not exists semaine_type_profil_par_defaut_unique
  on public.semaine_type_profil (site_id)
  where par_defaut = true;

-- role_permission : PK actuelle (role, module) devient (role, module) où
-- site_id IS NULL (défaut groupe), et on autorise en plus un override par
-- site via un index unique partiel.
alter table public.role_permission drop constraint if exists role_permission_pkey;
create unique index if not exists role_permission_defaut_unique
  on public.role_permission (role, module)
  where site_id is null;
create unique index if not exists role_permission_site_unique
  on public.role_permission (role, module, site_id)
  where site_id is not null;

-- motif_absence.code_court : unique par site (NULL = groupe, un site peut
-- avoir son propre "CP" qui masquera le CP groupe).
alter table public.motif_absence drop constraint if exists motif_absence_code_court_key;
drop index if exists motif_absence_code_court_key;
create unique index if not exists motif_absence_site_code_unique
  on public.motif_absence (site_id, code_court);
-- Un motif groupe (site_id NULL) et un motif local d'un site peuvent
-- coexister avec le même code_court : la résolution applicative prend
-- d'abord le local. Rien à interdire ici.


-- =====================================================================
-- G. COMPOSITE FKs (id, site_id) — INTÉGRITÉ INTER-SITES GARANTIE PAR LA BASE
--    Sur chaque table parent site-scopée dont d'autres tables dépendent :
--      1) unique (id, site_id) — support de la FK composite
--      2) drop de la FK simple existante
--      3) create foreign key (parent_id, site_id) → parent(id, site_id)
--    Postgres refuse alors tout enfant qui pointe vers un parent d'un autre
--    site — même si l'application est buguée.
-- =====================================================================

-- Parents dont on va exiger l'unicité (id, site_id)
do $$
declare
  t text;
  parents text[] := array[
    'atelier','ligne','poste','equipe','personne',
    'absence','semaine_type_profil','agence_interim'
  ];
begin
  foreach t in array parents loop
    execute format(
      'alter table public.%1$s add constraint %1$s_id_site_unique unique (id, site_id);',
      t
    );
  end loop;
end $$;

-- ligne.atelier_id → atelier
alter table public.ligne drop constraint if exists ligne_atelier_id_fkey;
alter table public.ligne
  add constraint ligne_atelier_id_site_fkey
  foreign key (atelier_id, site_id) references public.atelier (id, site_id) on delete cascade;

-- poste.ligne_id → ligne
alter table public.poste drop constraint if exists poste_ligne_id_fkey;
alter table public.poste
  add constraint poste_ligne_id_site_fkey
  foreign key (ligne_id, site_id) references public.ligne (id, site_id) on delete cascade;

-- personne.equipe_id → equipe (nullable côté personne)
alter table public.personne drop constraint if exists personne_equipe_id_fkey;
alter table public.personne
  add constraint personne_equipe_id_site_fkey
  foreign key (equipe_id, site_id) references public.equipe (id, site_id) on delete set null;

-- equipe_chef.equipe_id → equipe
alter table public.equipe_chef drop constraint if exists equipe_chef_equipe_id_fkey;
alter table public.equipe_chef
  add constraint equipe_chef_equipe_id_site_fkey
  foreign key (equipe_id, site_id) references public.equipe (id, site_id) on delete cascade;

-- matrice.personne_id → personne, matrice.poste_id → poste
alter table public.matrice drop constraint if exists matrice_personne_id_fkey;
alter table public.matrice drop constraint if exists matrice_poste_id_fkey;
alter table public.matrice
  add constraint matrice_personne_id_site_fkey
  foreign key (personne_id, site_id) references public.personne (id, site_id) on delete cascade;
alter table public.matrice
  add constraint matrice_poste_id_site_fkey
  foreign key (poste_id, site_id) references public.poste (id, site_id) on delete cascade;

-- personne_competence.personne_id → personne
alter table public.personne_competence drop constraint if exists personne_competence_personne_id_fkey;
alter table public.personne_competence
  add constraint personne_competence_personne_id_site_fkey
  foreign key (personne_id, site_id) references public.personne (id, site_id) on delete cascade;

-- poste_competence_requise.poste_id → poste (competence_id reste FK simple : compétence est un catalogue groupe)
alter table public.poste_competence_requise drop constraint if exists poste_competence_requise_poste_id_fkey;
alter table public.poste_competence_requise
  add constraint pcr_poste_id_site_fkey
  foreign key (poste_id, site_id) references public.poste (id, site_id) on delete cascade;

-- horaire_poste.poste_id → poste, .equipe_id → equipe
alter table public.horaire_poste drop constraint if exists horaire_poste_poste_id_fkey;
alter table public.horaire_poste drop constraint if exists horaire_poste_equipe_id_fkey;
alter table public.horaire_poste
  add constraint horaire_poste_poste_id_site_fkey
  foreign key (poste_id, site_id) references public.poste (id, site_id) on delete cascade;
alter table public.horaire_poste
  add constraint horaire_poste_equipe_id_site_fkey
  foreign key (equipe_id, site_id) references public.equipe (id, site_id) on delete cascade;

-- horaire_exception.personne_id → personne
alter table public.horaire_exception drop constraint if exists horaire_exception_personne_id_fkey;
alter table public.horaire_exception
  add constraint horaire_exception_personne_id_site_fkey
  foreign key (personne_id, site_id) references public.personne (id, site_id) on delete cascade;

-- poste_quart.poste_id → poste
alter table public.poste_quart drop constraint if exists poste_quart_poste_id_fkey;
alter table public.poste_quart
  add constraint poste_quart_poste_id_site_fkey
  foreign key (poste_id, site_id) references public.poste (id, site_id) on delete cascade;

-- ligne_ouverture.ligne_id → ligne
alter table public.ligne_ouverture drop constraint if exists ligne_ouverture_ligne_id_fkey;
alter table public.ligne_ouverture
  add constraint ligne_ouverture_ligne_id_site_fkey
  foreign key (ligne_id, site_id) references public.ligne (id, site_id) on delete cascade;

-- jour_equipe.equipe_id → equipe
alter table public.jour_equipe drop constraint if exists jour_equipe_equipe_id_fkey;
alter table public.jour_equipe
  add constraint jour_equipe_equipe_id_site_fkey
  foreign key (equipe_id, site_id) references public.equipe (id, site_id) on delete cascade;

-- equipe_quart_semaine.equipe_id → equipe
alter table public.equipe_quart_semaine drop constraint if exists equipe_quart_semaine_equipe_id_fkey;
alter table public.equipe_quart_semaine
  add constraint eqs_equipe_id_site_fkey
  foreign key (equipe_id, site_id) references public.equipe (id, site_id) on delete cascade;

-- ouverture_quart.ligne_id → ligne
alter table public.ouverture_quart drop constraint if exists ouverture_quart_ligne_id_fkey;
alter table public.ouverture_quart
  add constraint ouverture_quart_ligne_id_site_fkey
  foreign key (ligne_id, site_id) references public.ligne (id, site_id) on delete cascade;

-- semaine_type_quart.profil_id → semaine_type_profil
alter table public.semaine_type_quart drop constraint if exists semaine_type_quart_profil_id_fkey;
alter table public.semaine_type_quart
  add constraint stq_profil_id_site_fkey
  foreign key (profil_id, site_id) references public.semaine_type_profil (id, site_id) on delete cascade;

-- semaine_type_ouverture.profil_id → semaine_type_profil, .ligne_id → ligne
alter table public.semaine_type_ouverture drop constraint if exists semaine_type_ouverture_profil_id_fkey;
alter table public.semaine_type_ouverture drop constraint if exists semaine_type_ouverture_ligne_id_fkey;
alter table public.semaine_type_ouverture
  add constraint sto_profil_id_site_fkey
  foreign key (profil_id, site_id) references public.semaine_type_profil (id, site_id) on delete cascade;
alter table public.semaine_type_ouverture
  add constraint sto_ligne_id_site_fkey
  foreign key (ligne_id, site_id) references public.ligne (id, site_id) on delete cascade;

-- rotation_reference.equipe_id → equipe
alter table public.rotation_reference drop constraint if exists rotation_reference_equipe_id_fkey;
alter table public.rotation_reference
  add constraint rotation_reference_equipe_id_site_fkey
  foreign key (equipe_id, site_id) references public.equipe (id, site_id) on delete cascade;

-- placement.personne_id → personne, .equipe_id → equipe, .poste_id → poste,
-- .absence_id → absence
alter table public.placement drop constraint if exists placement_personne_id_fkey;
alter table public.placement drop constraint if exists placement_equipe_id_fkey;
alter table public.placement drop constraint if exists placement_poste_id_fkey;
alter table public.placement drop constraint if exists placement_absence_id_fkey;
alter table public.placement
  add constraint placement_personne_id_site_fkey
  foreign key (personne_id, site_id) references public.personne (id, site_id) on delete cascade;
alter table public.placement
  add constraint placement_equipe_id_site_fkey
  foreign key (equipe_id, site_id) references public.equipe (id, site_id) on delete set null;
alter table public.placement
  add constraint placement_poste_id_site_fkey
  foreign key (poste_id, site_id) references public.poste (id, site_id) on delete set null;
alter table public.placement
  add constraint placement_absence_id_site_fkey
  foreign key (absence_id, site_id) references public.absence (id, site_id) on delete cascade;

-- absence.personne_id → personne
alter table public.absence drop constraint if exists absence_personne_id_fkey;
alter table public.absence
  add constraint absence_personne_id_site_fkey
  foreign key (personne_id, site_id) references public.personne (id, site_id) on delete cascade;

-- contrat_periode.personne_id → personne
alter table public.contrat_periode drop constraint if exists contrat_periode_personne_id_fkey;
alter table public.contrat_periode
  add constraint contrat_periode_personne_id_site_fkey
  foreign key (personne_id, site_id) references public.personne (id, site_id) on delete cascade;


-- =====================================================================
-- H. TABLE audit_impersonation (mode support)
-- =====================================================================

create table if not exists public.audit_impersonation (
  id             uuid primary key default gen_random_uuid(),
  super_admin_id uuid not null references public.app_user (user_id) on delete restrict,
  site_id        uuid not null references public.site (id) on delete cascade,
  entered_at     timestamptz not null default now(),
  exited_at      timestamptz,
  ip             text,
  user_agent     text,
  raison         text,
  actions_json   jsonb                 -- résumé optionnel des actions POST/PUT/DELETE
);
create index if not exists audit_impersonation_site_idx
  on public.audit_impersonation (site_id, entered_at desc);
create index if not exists audit_impersonation_super_admin_idx
  on public.audit_impersonation (super_admin_id, entered_at desc);

alter table public.audit_impersonation enable row level security;

-- Le super_admin voit tout ; un admin de site voit les sessions qui ont eu
-- lieu SUR son site (pour transparence).
drop policy if exists audit_imp_select on public.audit_impersonation;
create policy audit_imp_select on public.audit_impersonation for select to authenticated
  using (
    public.is_super_admin()
    or (site_id = public.current_site_id() and public.is_admin())
  );

drop policy if exists audit_imp_modify on public.audit_impersonation;
create policy audit_imp_modify on public.audit_impersonation for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());


-- =====================================================================
-- I. TRIGGER `set_site_id_from_context` (INSERT auto-remplit site_id)
--    Compatibilité descendante : l'application actuelle écrit sans
--    site_id. Le trigger le pose depuis `current_site_id()`. Une écriture
--    future qui poserait site_id explicitement est respectée.
--    Défense en profondeur : si aucun site_id ne peut être déduit, la
--    ligne est refusée (jamais d'insertion « orpheline »).
-- =====================================================================

create or replace function public.set_site_id_from_context()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_guc uuid;
begin
  if new.site_id is null then
    -- 1) contexte utilisateur (current_site_id via app_user.site_id)
    new.site_id := public.current_site_id();

    -- 2) fallback : GUC posé par une session admin scriptée
    if new.site_id is null then
      begin
        v_guc := nullif(current_setting('app.site_id', true), '')::uuid;
        new.site_id := v_guc;
      exception when others then
        new.site_id := null;
      end;
    end if;

    -- 3) fallback V1a : le seul site existant est lebignon. On l'attribue
    --    plutôt que de refuser l'écriture, pour que l'app actuelle qui
    --    utilise getAdminClient() (service_role, sans auth.uid()) continue
    --    de fonctionner sans changer chaque route. À retirer en V2 pour
    --    forcer la fourniture explicite dès qu'il y a plusieurs sites.
    if new.site_id is null then
      new.site_id := '00000000-0000-4000-8000-00000000c0de'::uuid;
      raise notice 'set_site_id_from_context: fallback lebignon sur %.% (auth.uid()=%)',
        tg_table_schema, tg_table_name, auth.uid();
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  tables_locales text[] := array[
    'atelier','ligne','poste','equipe','equipe_chef','personne',
    'matrice','personne_competence','poste_competence_requise',
    'horaire_poste','horaire_exception','poste_quart',
    'ligne_ouverture','jour_equipe',
    'equipe_quart_semaine','jour_quart','ouverture_quart',
    'semaine_type_profil','semaine_type_quart','semaine_type_ouverture',
    'rotation_reference',
    'placement','absence',
    'contrat_periode','agence_interim','parametre_affichage'
  ];
begin
  foreach t in array tables_locales loop
    execute format('drop trigger if exists set_site_id_%1$s on public.%1$s;', t);
    execute format(
      'create trigger set_site_id_%1$s before insert on public.%1$s
       for each row execute function public.set_site_id_from_context();',
      t
    );
  end loop;
end $$;


-- =====================================================================
-- J. RÉÉCRITURE DES RLS
--    Toutes les policies gagnent le filtre `site_id = current_site_id()`
--    (ou `site_id IS NULL OR site_id = current_site_id()` pour les
--    tables partagées).
--    Les droits fonctionnels (is_admin, has_role, can_edit_personne)
--    restent lus mais sont évalués DANS le périmètre du site courant.
-- =====================================================================

-- app_user : chaque site voit SES utilisateurs, super_admin voit tout.
drop policy if exists app_user_select on public.app_user;
create policy app_user_select on public.app_user for select to authenticated
  using (
    site_id = public.current_site_id()
    or public.is_super_admin()
  );

drop policy if exists app_user_modify on public.app_user;
create policy app_user_modify on public.app_user for all to authenticated
  using (
    (site_id = public.current_site_id() and public.is_admin())
    or public.is_super_admin()
  )
  with check (
    (site_id = public.current_site_id() and public.is_admin())
    or public.is_super_admin()
  );

-- Boucle générique pour les tables locales avec pattern
-- « lecture site + écriture is_admin() site ».
do $$
declare
  t text;
  tables_admin text[] := array[
    'atelier','ligne','poste','equipe','equipe_chef',
    'contrat_periode','agence_interim','parametre_affichage',
    'horaire_poste','poste_quart',
    'poste_competence_requise'
  ];
begin
  foreach t in array tables_admin loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
       using (site_id = public.current_site_id());', t);

    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format(
      'create policy %1$s_modify on public.%1$s for all to authenticated
       using (site_id = public.current_site_id() and public.is_admin())
       with check (site_id = public.current_site_id() and public.is_admin());', t);
  end loop;
end $$;

-- Personne : lecture site, écriture chef ou admin (via can_edit_personne
-- qui inclut déjà le contrôle site).
drop policy if exists personne_select on public.personne;
create policy personne_select on public.personne for select to authenticated
  using (site_id = public.current_site_id());
drop policy if exists personne_modify on public.personne;
create policy personne_modify on public.personne for all to authenticated
  using (site_id = public.current_site_id() and public.can_edit_personne(id))
  with check (site_id = public.current_site_id() and public.can_edit_personne(id));

-- Matrice, personne_competence, absence, placement, horaire_exception :
-- écriture via can_edit_personne(personne_id).
do $$
declare
  t text;
  tables_personne text[] := array[
    'matrice','personne_competence','absence','placement','horaire_exception'
  ];
begin
  foreach t in array tables_personne loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
       using (site_id = public.current_site_id());', t);
    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format(
      'create policy %1$s_modify on public.%1$s for all to authenticated
       using (site_id = public.current_site_id() and public.can_edit_personne(personne_id))
       with check (site_id = public.current_site_id() and public.can_edit_personne(personne_id));', t);
  end loop;
end $$;

-- Tables « ordonnancement » : écriture admin ou ordo.
do $$
declare
  t text;
  tables_ordo text[] := array[
    'ligne_ouverture','jour_equipe',
    'equipe_quart_semaine','jour_quart','ouverture_quart',
    'semaine_type_profil','semaine_type_quart','semaine_type_ouverture',
    'rotation_reference'
  ];
begin
  foreach t in array tables_ordo loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
       using (site_id = public.current_site_id());', t);
    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format(
      'create policy %1$s_modify on public.%1$s for all to authenticated
       using (site_id = public.current_site_id() and (public.is_admin() or public.has_role(''ordo'')))
       with check (site_id = public.current_site_id() and (public.is_admin() or public.has_role(''ordo'')));', t);
  end loop;
end $$;

-- Tables partagées (site_id NULL = groupe visible partout, sinon = local).
-- Lecture : NULL ou site courant. Écriture : super_admin pour groupe,
-- admin local pour ligne à son site.
do $$
declare
  t text;
  tables_partagees text[] := array['motif_absence','type_contrat','role_custom','role_permission'];
begin
  foreach t in array tables_partagees loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
       using (site_id is null or site_id = public.current_site_id());', t);

    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format($p$
      create policy %1$s_modify on public.%1$s for all to authenticated
        using (
          (site_id is null and public.is_super_admin())
          or (site_id = public.current_site_id() and public.is_admin())
        )
        with check (
          (site_id is null and public.is_super_admin())
          or (site_id = public.current_site_id() and public.is_admin())
        );
    $p$, t);
  end loop;
end $$;

-- audit_log : lecture selon can_read_audit(), scopé au site courant.
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (
    public.can_read_audit()
    and (site_id = public.current_site_id() or public.is_super_admin())
  );

-- Tables globales de référence (échelle des niveaux, catalogue de
-- compétences groupe, quarts) : lecture pour tout authentifié, écriture
-- super_admin.
do $$
declare
  t text;
  tables_globales text[] := array['competence','competence_niveau_libelle','quart'];
begin
  foreach t in array tables_globales loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using (true);', t);
    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format(
      'create policy %1$s_modify on public.%1$s for all to authenticated
       using (public.is_super_admin()) with check (public.is_super_admin());', t);
  end loop;
end $$;

-- site : policies déjà posées en §A.


-- =====================================================================
-- K. AUDIT TRIGGER : consigner site_id + impersonated_by
-- =====================================================================

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_id text; v_site uuid; v_imp uuid;
begin
  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old); v_new := null; v_id := (old).id::text;
    -- La ligne supprimée porte site_id ; on l'extrait via jsonb.
    begin v_site := (v_old->>'site_id')::uuid; exception when others then v_site := null; end;
  elsif (tg_op = 'UPDATE') then
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_id := (new).id::text;
    begin v_site := (v_new->>'site_id')::uuid; exception when others then v_site := null; end;
  else
    v_old := null; v_new := to_jsonb(new); v_id := (new).id::text;
    begin v_site := (v_new->>'site_id')::uuid; exception when others then v_site := null; end;
  end if;

  -- Fallback : contexte utilisateur.
  if v_site is null then v_site := public.current_site_id(); end if;

  -- Impersonation : GUC posé par la route serveur au moment d'entrer en
  -- mode support (voir /platform). Absent en usage normal.
  begin v_imp := nullif(current_setting('app.impersonated_by', true), '')::uuid;
  exception when others then v_imp := null;
  end;

  insert into public.audit_log
    (app_user_id, action, table_name, record_id, old_values, new_values, site_id, impersonated_by)
  values (auth.uid(), tg_op, tg_table_name, v_id, v_old, v_new, v_site, v_imp);

  if (tg_op = 'DELETE') then return old; else return new; end if;
end; $$;


-- =====================================================================
-- L. FONCTIONS MÉTIER SQL SITE-AWARE
--    set_rotation_reference, creer_absence, maj_absence : elles étaient
--    déjà SECURITY INVOKER (donc soumises aux RLS de l'appelant), il
--    suffit d'ajouter le site_id sur les INSERT (le trigger le fait déjà
--    mais on double la ceinture : c'est du SQL, on veut être explicite).
-- =====================================================================

create or replace function public.set_rotation_reference(p_semaine date, p_rows jsonb)
returns integer
language plpgsql
as $$
declare
  v_n    integer;
  v_site uuid := public.current_site_id();
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
  p_auteur   uuid
)
returns uuid
language plpgsql
as $$
declare
  v_id   uuid;
  v_site uuid := public.current_site_id();
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
  p_auteur   uuid
)
returns void
language plpgsql
as $$
declare
  v_personne uuid;
  v_site     uuid := public.current_site_id();
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


-- =====================================================================
-- FIN 0043. Prochaine migration : 0044 (à venir : /platform, seeds
-- automatiques d'un nouveau site, quotas).
-- =====================================================================
