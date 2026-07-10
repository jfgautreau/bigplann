# Architecture — BigPlann'

Application web de gestion des plannings d'usine (matrice de polyvalence,
placement journalier, habilitations, affichage couloir, bilans).

> Vue d'ensemble et règles de travail : **CLAUDE.md**.

## Stack
- **Next.js 16** (App Router, Server Components + Server Actions) + React 19 + TypeScript
- **Supabase** : PostgreSQL + Auth + Row Level Security (RLS), via `@supabase/ssr`
- **Déploiement** : Vercel (push GitHub → build automatique, région `cdg1`, Fluid Compute)
- **Tests** : Vitest (règles métier pures)

## Couches
- `src/lib/supabase.ts` — client navigateur (clé anon, soumis à la RLS).
- `src/lib/supabase-server.ts` — `getServerClient()` (session utilisateur, RLS) et
  `getAdminClient()` (service_role, **bypass RLS**, usage serveur contrôlé : invitations,
  affichage couloir public, export RGPD, écritures « module » validées).
- `src/lib/current-user.ts` — `getCurrentProfile()`, `requireAdmin()`.
- `src/lib/permissions.ts` — matrice de droits par module (`MODULES`, `defaultsFor`,
  `getPermissions`, `canRead`/`canWrite`, `canWriteModule`, `requireModule`).
- `src/lib/refdata.ts` — cache des données de référence (`unstable_cache`, 30 s).
- `src/proxy.ts` — protège les routes (redirige vers /login). Public : `/login`, `/forgot`,
  `/reset`, `/auth/*`, `/affichage/*`.
- `src/components/AppHeader.tsx` — navigation par rôle + cloche d'alerte habilitations.

## Modèle de données (Supabase / PostgreSQL)
- **Auth & droits** : `app_user` (compte + rôle), liée à `auth.users` (trigger
  `handle_new_user`) ; `role_permission` (surcharge de la matrice de droits par module).
- **Référentiel** : `atelier` > `ligne` > `poste` (`effectif_requis` = abaque, `nom_court`,
  `categorie` manager/conducteur/operateur, `niveau_min_requis`, `objectif_polyvalence`,
  `objectif_cible`, `ordre_affichage`), `equipe` (+ `quart_fixe`), `equipe_chef`.
- **Quarts** : `quart` (`journee`/`matin`/`apres_midi`/`nuit` + horaires),
  `equipe_quart_semaine` (rotation équipe→quart par semaine), `poste_quart` (activation
  poste×quart, défaut actif : ne stocke que les désactivations), `jour_quart`,
  `ouverture_quart`, `horaire_poste` (poste × quart × jour).
- **Personnel** : `personne` (équipe, atelier, statut ACTIF/PARTI, type_contrat, sexe,
  `numero_badge`, `date_livret_accueil`, temps partiel `tp_config` jsonb ; champs RGPD
  `anonymise`/`anonymise_at`), `contrat_periode`.
- **Matrice** : `matrice` (niveau actuel/cible par personne×poste, valeur spéciale
  « restriction »), `competence_niveau_libelle` (échelle paramétrable).
- **Habilitations** : `competence` (`a_recycler`, `duree_validite_mois`, `categorie`,
  `groupe`, `ordre`, `a_autorisation_conduite`), `personne_competence`
  (`date_obtention`, `date_expiration` **stockée à la saisie**, `date_autorisation_conduite`).
- **Planning** : `ligne_ouverture`, `jour_equipe`, `placement` (1 personne/jour : poste,
  ou motif d'absence, ou non travaillé), `horaire_exception` (personne × jour),
  `absence` (période longue → `placement.absence_id`, cascade),
  `semaine_type` (+ ouverture, profils).
- **Absences** : `motif_absence` (paramétrable, couleur).
- **Transverse** : `audit_log` (alimenté par triggers).

## Rôles & périmètres
Deux couches, à ne pas confondre :
1. **Matrice de modules** (`role_permission` + `defaultsFor()`) : `none` / `read` / `write`
   par module et par rôle.
2. **Périmètre RLS** : `can_edit_personne()` = admin **ou** chef de l'équipe de la personne.

`canWriteModule()` renvoie toujours `false` pour `chef_equipe` : même si le module est en
`write`, le chef n'obtient jamais le client admin et reste borné à son équipe par la RLS.

Écriture en base :
- Référentiel, équipes, compétences, motifs, objectifs, personnel : **admin**.
- Matrice / placement / habilitations : **admin ou chef de l'équipe** (`can_edit_personne()`).
- Ouverture de lignes, rotation des équipes : **admin ou ordo** (`has_role('ordo')`).
- Journal d'audit : lecture **admin + codir** (`can_read_audit()`).

Rôles : `admin`, `chef_equipe`, `ordo`, `rh`, `codir`, `planning`.

## Audit
Triggers PostgreSQL (`audit_trigger`) sur les tables métier → `audit_log`
(qui via `auth.uid()`, action, table, ancienne/nouvelle valeur en JSON).

## Migrations
Fichiers SQL ordonnés dans `supabase/migrations/` (**0001 → 0029**), **exécutés
manuellement** par l'utilisateur dans le SQL Editor Supabase (`SUPABASE_DB_URL` est vide ;
`npm run db:migrate` ne fonctionne que s'il est défini).

## Sitemap (principales routes)
- `/` accueil (logo + titre « planning »), `/planning`, `/ordonnancement`
  (+ `/ordonnancement/semaine-type`), `/matrice` (+ `/matrice/bilan`), `/habilitations`,
  `/personnel` (+ `/personnel/[id]`), `/bilans` (+ personnel, polyvalence, couverture,
  anticipation, competences), `/horaires-specifiques`, `/absences-specifiques`.
- Admin : `/admin/referentiel`, `/admin/equipes`, `/admin/competences`,
  `/admin/habilitations-param`, `/admin/motifs`, `/admin/horaires`, `/admin/rotation`,
  `/admin/users`, `/admin/droits`, `/admin/rgpd`, `/journal`.
- Public : `/affichage`, `/affichage/atelier/[atelier]` (écran TV, refresh 60 s).
