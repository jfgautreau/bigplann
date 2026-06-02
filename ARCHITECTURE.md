# Architecture — BigPlann'

Application web de gestion des plannings d'usine (matrice de polyvalence,
placement journalier, habilitations, affichage couloir).

## Stack
- **Next.js 16** (App Router, Server Components + Server Actions) + React 19 + TypeScript
- **Supabase** : PostgreSQL + Auth + Row Level Security (RLS), via `@supabase/ssr`
- **Déploiement** : Vercel (push GitHub → build automatique)
- **Tests** : Vitest (règles métier pures)

## Couches
- `src/lib/supabase.ts` — client navigateur (clé anon, soumis à la RLS).
- `src/lib/supabase-server.ts` — `getServerClient()` (session utilisateur, RLS) et
  `getAdminClient()` (service_role, **bypass RLS**, usage serveur contrôlé : invitations,
  affichage couloir public, export RGPD).
- `src/lib/current-user.ts` — `getCurrentProfile()`, `requireAdmin()`.
- `src/proxy.ts` — protège les routes (redirige vers /login). Public : /login, /forgot,
  /reset, /auth/*, /affichage.
- `src/components/AppHeader.tsx` — navigation par rôle + cloche d'alerte habilitations.

## Modèle de données (Supabase / PostgreSQL)
- **Auth** : `app_user` (compte + rôle), liée à `auth.users` (trigger `handle_new_user`).
- **Référentiel** : `atelier` > `ligne` > `poste` (avec `effectif_requis` = abaque,
  `nom_court`, `objectif_polyvalence`, `objectif_cible`, `est_conducteur`), `equipe`,
  `equipe_chef`.
- **Personnel** : `personne` (rattachée à une équipe ; champs RGPD `anonymise`/`anonymise_at`).
- **Matrice** : `matrice` (niveau actuel/cible par personne×poste), `competence`
  (transverses + habilitations à recycler), `personne_competence`,
  `competence_niveau_libelle` (échelle paramétrable).
- **Planning** : `ligne_ouverture` (jour×ligne×équipe), `jour_equipe` (nuit on/off),
  `placement` (1 personne/jour : poste, ou motif d'absence, ou non travaillé).
- **Absences** : `motif_absence` (paramétrable, couleur).
- **Transverse** : `audit_log` (alimenté par triggers).

## Rôles & périmètres (RLS)
- Lecture : tous les utilisateurs authentifiés.
- Écriture :
  - Référentiel, équipes, compétences, motifs, objectifs : **admin** (`is_admin()`).
  - Personnel : admin.
  - Matrice / placement / habilitations : **admin ou chef de l'équipe** de la personne
    (`can_edit_personne()`).
  - Ouverture de lignes / activation d'équipes : **admin ou ordonnancement** (`has_role('ordo')`).
  - Journal d'audit : lecture **admin + codir** (`can_read_audit()`).
- Rôles : `admin`, `chef_equipe`, `ordo`, `rh`, `codir`, `planning`.

## Audit
Triggers PostgreSQL (`audit_trigger`) sur les tables métier → `audit_log`
(qui via `auth.uid()`, action, table, ancienne/nouvelle valeur en JSON).

## Migrations
Fichiers SQL ordonnés dans `supabase/migrations/` (0001 → 0009), exécutés dans le
SQL Editor Supabase (ou `npm run db:migrate` si `SUPABASE_DB_URL` est défini).

## Sitemap (principales routes)
- `/planning` (accueil), `/ordonnancement`, `/matrice` (+ `/matrice/bilan`),
  `/habilitations`, `/personnel` (+ `/personnel/[id]`), `/bilans`.
- Admin : `/admin/referentiel`, `/admin/equipes`, `/admin/competences`,
  `/admin/motifs`, `/admin/users`, `/admin/rgpd`, `/journal`.
- Public : `/affichage`, `/affichage/atelier/[id]` (écran TV, refresh 60 s).
