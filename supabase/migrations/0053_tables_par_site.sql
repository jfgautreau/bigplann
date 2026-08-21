-- =====================================================================
-- Migration 0053 - Séparation totale des référentiels par site
--
-- Passe les 7 dernières tables partagées en `site_id NOT NULL` :
--   competence, competence_niveau_libelle, quart,
--   motif_absence, type_contrat, role_custom, role_permission
--
-- Après cette migration, PLUS AUCUNE ligne partagée entre sites : chaque
-- nouveau site part d'un référentiel copié depuis un site SOURCE (choisi
-- à la création via /platform).
--
-- Rationale : la coexistence « ligne groupe (NULL) + surcharge locale »
-- introduite en 0043 s'est révélée trop subtile — code applicatif compliqué
-- (`or site_id.is.null,…`), règles de résolution implicites, aucune
-- isolation stricte. Vu le peu de valeur (deux usines n'ont aucun besoin de
-- partager LE MÊME motif d'absence), on tranche : tout par site.
--
-- === Hypothèses de départ ===
--   * Un seul site actif : Lebignon (UUID '…c0de'). Tout site tiers déjà
--     créé (« La Vraie Croix » notamment) a été supprimé AVANT exécution
--     de cette migration — sinon les lignes site_id IS NULL seraient
--     rebasculées vers Lebignon indépendamment de leur origine.
--   * pg_dump obligatoire AVANT exécution : cette migration est
--     irréversible.
--
-- À exécuter dans le SQL Editor du projet Supabase APRÈS 0052.
-- =====================================================================


-- =====================================================================
-- A. BACKFILL DES NULLS RESTANTS (tables déjà nullables depuis 0043)
--    Sécurité : on ne bouge que les lignes NULL, on ne remplace jamais
--    une ligne site_id NOT NULL par le site historique.
-- =====================================================================

update public.motif_absence
   set site_id = '00000000-0000-4000-8000-00000000c0de'
 where site_id is null;

update public.type_contrat
   set site_id = '00000000-0000-4000-8000-00000000c0de'
 where site_id is null;

update public.role_custom
   set site_id = '00000000-0000-4000-8000-00000000c0de'
 where site_id is null;

update public.role_permission
   set site_id = '00000000-0000-4000-8000-00000000c0de'
 where site_id is null;


-- =====================================================================
-- B. AJOUT DE site_id SUR LES 3 TABLES GLOBALES RESTANTES
--    DEFAULT = Lebignon (backfill implicite), retiré en §D une fois les
--    contraintes en place.
-- =====================================================================

alter table public.competence
  add column if not exists site_id uuid not null
  default '00000000-0000-4000-8000-00000000c0de'
  references public.site (id) on delete cascade;
create index if not exists competence_site_idx on public.competence (site_id);

alter table public.competence_niveau_libelle
  add column if not exists site_id uuid not null
  default '00000000-0000-4000-8000-00000000c0de'
  references public.site (id) on delete cascade;
create index if not exists competence_niveau_libelle_site_idx
  on public.competence_niveau_libelle (site_id);

alter table public.quart
  add column if not exists site_id uuid not null
  default '00000000-0000-4000-8000-00000000c0de'
  references public.site (id) on delete cascade;
create index if not exists quart_site_idx on public.quart (site_id);


-- =====================================================================
-- C. PASSAGE EN NOT NULL DES 4 TABLES ENCORE NULLABLES
-- =====================================================================

alter table public.motif_absence   alter column site_id set not null;
alter table public.type_contrat    alter column site_id set not null;
alter table public.role_custom     alter column site_id set not null;
alter table public.role_permission alter column site_id set not null;


-- =====================================================================
-- D. RETRAIT DES DEFAULTS
--    L'application fournit désormais site_id explicitement (via le
--    trigger set_site_id_from_context en filet de sécurité). Laisser un
--    DEFAULT lebignon serait un piège : le jour où un bug oublie site_id,
--    la ligne atterrirait chez Lebignon en silence.
-- =====================================================================

alter table public.competence                alter column site_id drop default;
alter table public.competence_niveau_libelle alter column site_id drop default;
alter table public.quart                     alter column site_id drop default;


-- =====================================================================
-- E. RÉÉCRITURE DES PKs ET UNICITÉS
-- =====================================================================

-- role_permission : PK (role, module) — devenue insuffisante depuis 0043
-- qui a ajouté site_id nullable + deux index partiels. On unifie sous une
-- PK composite qui inclut site_id.
drop index if exists role_permission_defaut_unique;
drop index if exists role_permission_site_unique;
alter table public.role_permission drop constraint if exists role_permission_pkey;
alter table public.role_permission add primary key (role, module, site_id);

-- type_contrat : PK (code) → (code, site_id). Le CHECK de 0041 (sur code)
-- reste valide, il ne dépend pas de la PK.
alter table public.type_contrat drop constraint if exists type_contrat_pkey;
alter table public.type_contrat add primary key (code, site_id);

-- role_custom : PK (code) → (code, site_id). Le libellé unique de 0042
-- devient site-scopé (deux sites peuvent avoir chacun un rôle « Chef »).
alter table public.role_custom drop constraint if exists role_custom_pkey;
alter table public.role_custom add primary key (code, site_id);

drop index if exists role_custom_libelle_unique;
create unique index if not exists role_custom_site_libelle_unique
  on public.role_custom (site_id, lower(libelle));

-- competence_niveau_libelle : PK (niveau) → (site_id, niveau).
alter table public.competence_niveau_libelle drop constraint if exists competence_niveau_libelle_pkey;
alter table public.competence_niveau_libelle add primary key (site_id, niveau);

-- motif_absence : l'index unique (site_id, code_court) créé par 0043
-- reste bon (site_id est simplement passé NOT NULL, l'unicité tient).


-- =====================================================================
-- F. QUART : LA MANOEUVRE DÉLICATE
--    On change quart.PK de (code) en (code, site_id). Il faut donc :
--      1. dropper TOUTES les FKs enfants qui pointent aujourd'hui sur
--         quart(code) — sinon `drop constraint quart_pkey` refuse ;
--      2. recréer la PK composite ;
--      3. recréer les FKs enfants en COMPOSITE (quart_code, site_id) →
--         quart(code, site_id). Toutes les tables enfants portent déjà
--         `site_id NOT NULL` depuis 0043, donc la composite est possible.
--
--    Note PostgREST : aucun endroit de l'application ne fait
--    `.select("quart(...)")` en embed implicite (les 14 lectures sont
--    séparées : `from("quart").select(...)`). La composite FK est donc
--    sans risque ici — pas de reprise du bug de 0046/0047.
-- =====================================================================

-- 1) Drop des FKs simples. Nom généré par Postgres : `<table>_<colonne>_fkey`.
alter table public.jour_quart              drop constraint if exists jour_quart_quart_code_fkey;
alter table public.ouverture_quart         drop constraint if exists ouverture_quart_quart_code_fkey;
alter table public.poste_quart             drop constraint if exists poste_quart_quart_code_fkey;
alter table public.semaine_type_quart      drop constraint if exists semaine_type_quart_quart_code_fkey;
alter table public.semaine_type_ouverture  drop constraint if exists semaine_type_ouverture_quart_code_fkey;
alter table public.rotation_reference      drop constraint if exists rotation_reference_quart_code_fkey;
alter table public.horaire_poste           drop constraint if exists horaire_poste_quart_code_fkey;
alter table public.horaire_exception       drop constraint if exists horaire_exception_quart_code_fkey;
alter table public.placement               drop constraint if exists placement_quart_code_fkey;
alter table public.equipe                  drop constraint if exists equipe_quart_fixe_fkey;

-- 2) Nouvelle PK composite.
alter table public.quart drop constraint if exists quart_pkey;
alter table public.quart add primary key (code, site_id);

-- 3) Recréation des FKs enfants en composite.
alter table public.jour_quart
  add constraint jour_quart_quart_fkey
  foreign key (quart_code, site_id) references public.quart (code, site_id);

alter table public.ouverture_quart
  add constraint ouverture_quart_quart_fkey
  foreign key (quart_code, site_id) references public.quart (code, site_id);

alter table public.poste_quart
  add constraint poste_quart_quart_fkey
  foreign key (quart_code, site_id) references public.quart (code, site_id);

alter table public.semaine_type_quart
  add constraint semaine_type_quart_quart_fkey
  foreign key (quart_code, site_id) references public.quart (code, site_id) on delete cascade;

alter table public.semaine_type_ouverture
  add constraint semaine_type_ouverture_quart_fkey
  foreign key (quart_code, site_id) references public.quart (code, site_id) on delete cascade;

alter table public.rotation_reference
  add constraint rotation_reference_quart_fkey
  foreign key (quart_code, site_id) references public.quart (code, site_id);

alter table public.horaire_poste
  add constraint horaire_poste_quart_fkey
  foreign key (quart_code, site_id) references public.quart (code, site_id);

alter table public.horaire_exception
  add constraint horaire_exception_quart_fkey
  foreign key (quart_code, site_id) references public.quart (code, site_id);

-- placement.quart_code est NULLABLE (absences historiques sans quart) :
-- la composite FK doit tolérer NULL côté enfant. Postgres l'accepte
-- naturellement : une ligne dont l'UNE des colonnes de la FK est NULL
-- n'est pas contrôlée (MATCH SIMPLE, comportement par défaut).
alter table public.placement
  add constraint placement_quart_fkey
  foreign key (quart_code, site_id) references public.quart (code, site_id);

-- equipe.quart_fixe est NULLABLE aussi (une équipe non tournante n'a pas
-- de quart fixe).
alter table public.equipe
  add constraint equipe_quart_fixe_fkey
  foreign key (quart_fixe, site_id) references public.quart (code, site_id);


-- =====================================================================
-- F'. jour_quart : PK insuffisante en multi-site (dette du socle 0043)
--     `jour_quart` a une PK (jour, quart_code) qui ne contient PAS
--     site_id — deux sites ne peuvent donc pas partager la même clé,
--     le second INSERT serait refusé pour violation de PK.
--
--     Correction : PK devient (site_id, jour, quart_code). Toutes les
--     routes qui font `upsert(jour_quart, { onConflict: "jour,quart_code" })`
--     doivent aussi passer à `"site_id,jour,quart_code"`.
--
--     Les autres tables `jour_*` / `*_quart` ont une PK qui inclut au
--     moins un UUID déjà site-scopé (ligne_id, poste_id, equipe_id,
--     profil_id) et restent uniques par site sans changement.
--     `semaine_type_quart(profil_id, quart_code, jour_semaine)` en fait
--     partie via profil_id → semaine_type_profil(site_id) NOT NULL.
-- =====================================================================

alter table public.jour_quart drop constraint if exists jour_quart_pkey;
alter table public.jour_quart add primary key (site_id, jour, quart_code);


-- =====================================================================
-- G. RÉÉCRITURE DES RLS DES 7 TABLES
--    Plus de branche « site_id IS NULL OR … » : chaque ligne appartient
--    strictement à un site. Écriture : admin local du site (les données
--    de référence sont paramétrables depuis les écrans /admin/*).
-- =====================================================================

do $$
declare
  t text;
  tables_site text[] := array[
    'motif_absence','type_contrat','role_custom','role_permission',
    'competence','competence_niveau_libelle','quart'
  ];
begin
  foreach t in array tables_site loop
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


-- =====================================================================
-- H. TRIGGERS set_site_id_from_context SUR LES 7 TABLES
--    Cohérence avec 0043 §I : compatibilité descendante avec les
--    écritures qui n'auraient pas encore basculé sur site_id explicite.
--    La fonction elle-même reste inchangée (fallback lebignon en V1a).
-- =====================================================================

do $$
declare
  t text;
  tables_site text[] := array[
    'motif_absence','type_contrat','role_custom','role_permission',
    'competence','competence_niveau_libelle','quart'
  ];
begin
  foreach t in array tables_site loop
    execute format('drop trigger if exists set_site_id_%1$s on public.%1$s;', t);
    execute format(
      'create trigger set_site_id_%1$s before insert on public.%1$s
       for each row execute function public.set_site_id_from_context();',
      t);
  end loop;
end $$;


-- =====================================================================
-- FIN 0053
--
-- Post-migration à faire dans le code :
--   * refdata.ts : retirer la clause `or(site_id.is.null,…)` sur motifs,
--     rendre getQuartsC et getNiveauxC site-scopés.
--   * roles-server.ts : getCustomRoles filtre par site.
--   * permissions.ts : getPermissions / getAllPermissions filtrent par site.
--   * /admin/motifs, /admin/competences, /api/roles, /api/droits :
--     tous les INSERT posent `site_id: profile.siteId`.
--   * /admin/equipes saveQuartHoraires : filtre .eq('site_id', siteId) sur
--     le update de quart.
--   * /platform/nouveau : formulaire ajoute un select « site source » ;
--     createSite copie en cascade les référentiels du site source vers
--     le nouveau site.
-- =====================================================================
