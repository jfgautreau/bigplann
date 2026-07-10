# BigPlann' — brief agent

App web de gestion des plannings d'une usine agroalimentaire. **Réponds en français.**

Ce fichier est le seul chargé automatiquement : il doit suffire pour 90 % des tâches.
Docs plus profondes (à lire **seulement si besoin**) : `ARCHITECTURE.md` (modèle de
données, RLS), `tasks/handoff.md` (détail métier & patterns), `tasks/lessons.md`
(pièges déjà rencontrés), `INSTALL.md` / `OPERATIONS.md`.

## Stack & emplacements
- `C:\dev\planning-usine` · remote `github.com/jfgautreau/bigplann` · branche **main**.
- **Next.js 16** (App Router, RSC + server actions) · React 19 · TypeScript · **Supabase**
  (Postgres + Auth + RLS) · déploiement **Vercel** (push `main` → build auto, région `cdg1`).
- Scripts : `npm run dev` · `npm run build` · `npm test` (Vitest).

## Règles de travail (non négociables)
1. **`npm run build` avant tout commit.** Le build échoue sur les erreurs TS/ESLint
   (imports et variables inutilisés inclus) — nettoie ce que tu retires.
2. **Commit + push sur `main` après chaque tâche terminée**, sans redemander.
   Message en français, style conventional commit. Trailer
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Pas de branche ni de PR.
3. **Auteur git = `jf.gautreau@gmail.com`** — ne jamais forcer un email no-reply
   (bloque les déploiements Vercel Hobby).
4. **Base de données : jamais de DDL par l'agent.** `SUPABASE_DB_URL` est vide et le
   MCP Supabase pointe sur un autre compte. Écris la migration dans
   `supabase/migrations/` et **demande à l'utilisateur de l'exécuter** dans le SQL Editor.
   Pour de la *donnée* seulement, un script Node lisant `SUPABASE_SERVICE_ROLE_KEY`
   de `.env.local` est acceptable.
   Projet Supabase : ref `stcxlsmmnplxpirrnefm`, eu-west-3. **Dernière migration appliquée : `0029`.**
5. **PowerShell 5.1** : pour un message de commit multi-lignes, here-string `@'…'@`
   (le `'@` final en colonne 0), ou `git commit -F fichier`. Pas de `"` inline.

## Sécurité / permissions — les 2 couches à ne pas confondre
- **Couche A — matrice de modules** : table `role_permission` surchargeant `defaultsFor()`
  dans `src/lib/permissions.ts` (`MODULES`, `canRead`, `canWrite`, `requireModule`).
- **Couche B — périmètre RLS** : `can_edit_personne()` = admin **ou** chef de l'équipe
  de la personne.
- ⚠️ `canWriteModule(role, mod)` renvoie **toujours `false` pour `chef_equipe`** : le chef
  reste cantonné à son périmètre. Dans les API : si écriture « complète » →
  `getAdminClient()` (bypass RLS) ; sinon `getServerClient()` (RLS). Ne jamais donner
  le client admin à un chef d'équipe.
- Rôles : `admin`, `chef_equipe`, `ordo`, `rh`, `codir`, `planning`.
- Routes publiques (`src/proxy.ts`) : `/login`, `/forgot`, `/reset`, `/auth/*`, `/affichage/*`.

## Modèle métier — les pièges
- **Quart ≠ Équipe.** Quarts : `journee`/`matin`/`apres_midi`/`nuit` (table `quart`).
  Les équipes tournent par semaine (`equipe_quart_semaine`) sauf si `equipe.quart_fixe`.
  Défaut planning = `matin`. Sur `/planning`, choisir un quart auto-sélectionne
  l'équipe de la rotation de la semaine (forçage possible via le filtre Équipe).
- **`poste_quart`** : activation poste×quart, **défaut actif** → la table ne stocke que
  les *désactivations*.
- **`poste.categorie`** ∈ manager/conducteur/operateur (source des bilans).
  `est_conducteur` est **déprécié**.
- **Habilitations** : `competence` (`a_recycler=true`, `duree_validite_mois`, `ordre`,
  `groupe`, `categorie`) × `personne_competence`. ⚠️ `date_expiration` est **stockée au
  moment de la saisie**, pas recalculée en lecture : si la durée de validité change
  après coup, l'échéance stockée reste fausse (ou nulle). À l'affichage, passer par
  `addMonthsIso(date_obtention, duree)` en repli — cf. `src/lib/habilitations.ts`.
  Statut : rouge < 30 j · orange 30-90 j · vert > 90 j.
- **Absences longues** (`absence`) : matérialisées en `placement` (un par jour), liés par
  `placement.absence_id` (cascade).
- **Temps partiel** : `personne.tp_config` (jsonb, options cumulables `demi`/`off`/`horaires`).
  Le planning calcule `tpBlocked` / `tpRedirect` **côté serveur** selon le quart.
- **Horaires affichés** (TV), par priorité : exception ponctuelle > temps partiel > standard.

## Patterns UI maison (réutilise-les, n'invente pas)
- **Édition inline auto-enregistrée** : `useState` + `fetch` debouncé → route API,
  avec indicateur « Enregistré ✓ ». Cf. `PersonnelEditor`, `ReferentielEditor`, `MatrixGrid`.
- ⚠️ **Un `<select>` contrôlé dans un composant client ne se sérialise pas de façon
  fiable** dans un `<form action={serverAction}>` parent. Pour une grille éditable,
  poster explicitement en JSON vers une route API (cf. `/api/ordonnancement/rotation`).
- ⚠️ **Jamais d'`<input type="color">`** : la boîte de dialogue OS fait planter le
  navigateur ici. Utiliser une palette de pastilles (`TeamColorPicker`).
- **Listes en 2 tableaux** (Personnel, Planning, Matrice) : un tableau figé (en-têtes +
  bilan rétractable) et un tableau scrollable. Colonnes alignées via `colgroup` commun +
  `table-layout: fixed` + `scrollbar-gutter: stable`. **Pas de scroll horizontal.**
- **Filtres** : `.filterrow` (label + segments), navigation en `useTransition`.
  Planning : ordre **Quart / Atelier / Équipe**.
- **Modales** : overlay `position:fixed` + `.card` (`TempsPartielModal`, `LegendeModal`,
  modale MàJ des habilitations).
- `ToggleSwitch` partagé. **`prefetch={false}`** sur tout lien répété en liste.

## Performance (état : bon, ~300 ms à chaud — ne pas régresser)
Acquis à préserver : région `cdg1` + Fluid Compute · options de `<select>` construites
**à l'ouverture seulement** (planning) · `prefetch={false}` · cache des données de
référence (`src/lib/refdata.ts`, `unstable_cache` 30 s) · `loading.tsx` sur les gros écrans.
En réserve : virtualisation des grandes grilles.

## Carte des fichiers
- Socle : `src/lib/{permissions,roles,current-user,week,refdata,habilitations,supabase-server}.ts`, `src/proxy.ts`.
- Nav : `src/components/{AppHeader,SettingsMenu,UserMenu,ToggleSwitch,NavIcons}.tsx`.
  Logo → `/` (page d'accueil : logo centré + titre « planning »).
- Planning : `src/app/planning/{page,PlanningGrid,PlanningFilters,AtelierFilter,QuartSelector}.tsx`.
- Matrice : `src/app/matrice/{page,MatricePanel,MatrixGrid,Pie,LegendeModal}.tsx`.
- Personnel : `src/app/personnel/*` + `src/app/api/personnel/route.ts`.
- Référentiel : `src/app/admin/referentiel/*` + `src/app/api/referentiel/route.ts`.
- Habilitations : `src/app/habilitations/*` + `src/app/admin/habilitations-param/*`.
- Bilans : `src/app/bilans/*` (Cockpit + 4 catégories, impression PDF via `@media print`).
- Affichage TV : `src/app/affichage/atelier/[atelier]/page.tsx` (public, refresh 60 s).
- Migrations : `supabase/migrations/0001..0029`.
