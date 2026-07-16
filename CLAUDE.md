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
   Projet Supabase : ref `stcxlsmmnplxpirrnefm`, eu-west-3. **Dernière migration appliquée : `0031`.**
5. **PowerShell 5.1** : pour un message de commit multi-lignes, here-string `@'…'@`
   (le `'@` final en colonne 0), ou `git commit -F fichier`. Pas de `"` inline.
6. ⚠️ **Toute lecture Supabase pouvant dépasser 1000 lignes passe par `fetchAll()`**
   (`src/lib/fetch-all.ts`). PostgREST plafonne chaque réponse à 1000 lignes **sans
   erreur** : `data` en contient 1000, `error` vaut `null`, la page affiche des données
   incomplètes. Concernées : `matrice` (1600+), `personne_competence` (1400+),
   `placement` et `ouverture_quart` (croissantes). La fabrique de requête doit poser un
   `.order()` déterministe ; `ouverture_quart` et `jour_quart` n'ont pas d'`id` → trier
   sur la clé composite. Cf. `tasks/lessons.md` L8.

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
  Les équipes tournent sauf si `equipe.quart_fixe`. **Rotation par référence datée**
  (`rotation_reference`, cf. `src/lib/rotation.ts` ; écran fusionné dans `/admin/equipes`) :
  on saisit, pour **une** semaine (lundi),
  le quart de chaque équipe tournante ; l'alternance des semaines suivantes est **calculée**
  (rotation cyclique du vecteur de quarts), jamais stockée. Pour une semaine cible, la
  référence active est la plus récente ≤ cette semaine → changer la rotation = **ajouter une
  nouvelle référence datée**, le passé n'est jamais recalculé. Avant toute référence : pas de
  rotation. L'ancienne table `equipe_quart_semaine` (saisie semaine-par-semaine) est conservée
  mais **plus lue/écrite**. Défaut planning = `matin`. Sur `/planning`, choisir un quart
  auto-sélectionne l'équipe de la rotation de la semaine (forçage possible via le filtre Équipe).
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

## Ossature des écrans « grille » (globals.css)
Matrice, Personnel, Planning, Habilitations, Ordonnancement partagent trois classes :
- `.pagecol` — page à la hauteur de la fenêtre (`100dvh`). **Aucun défilement de page** :
  seule la grille défile. Remplace les hauteurs magiques `calc(100vh - N)`.
- `.headband` (+ `.headband-top`) — titre et filtres dans la colonne centrée de 1500 px.
- `.gridband` — la grille prend **toute la largeur** de la fenêtre. Variante
  `.gridband.scroll` quand plusieurs cartes s'empilent (Ordonnancement).
  Dernière carte scrollable : lui donner la classe `grow`.

⚠️ **Les 6 pages de Bilans et `/matrice/bilan` restent à 1500 px** : ce sont des rapports
imprimables (A4 paysage, KPI, barres) que la pleine largeur dégraderait.

## Grille « personnes × colonnes » (partagée Matrice ↔ Habilitations)
`src/components/persongrid.module.css` + `usePersonGrid()`. **Ne pas la dupliquer.**
- Deux tableaux (en-têtes figés + liste scrollable), colonnes alignées par un `colgroup`
  commun + `table-layout: fixed`.
- Colonne des noms **figée** (`position: sticky; left: 0`).
- Colonnes **élastiques** : `min-width: calc(var(--name-w) + var(--n-cols) * var(--col-min))`
  (36 px mini) → scroll horizontal seulement quand la fenêtre est trop étroite.
- **Survol en croix** : la colonne est peinte via le fond du `<col>` + une classe sur son
  en-tête, écrits directement dans le DOM (aucun rendu React, gratuit sur 20 000 cellules).
- Réglages en un seul endroit : `--row-h: 32px`, `--cell: 28px` (la pastille fait 28 px,
  l'écart vertical 2 px), `--col-min: 36px`. `--accent*` teinte les en-têtes (la Matrice
  les surcharge selon Actuel/Cible via `.matrice.matrice[data-mode]`).
- ⚠️ Le panneau d'en-têtes est en `overflow-y: scroll` (pas `auto` + `scrollbar-gutter`) :
  sur un axe `overflow: hidden`, Chrome retranche la gouttière de la zone défilable et le
  `scrollLeft` asservi s'arrête 15 px trop tôt. Cf. `tasks/lessons.md` L9.

## Autres patterns UI (réutilise-les, n'invente pas)
- **Édition inline auto-enregistrée** : `useState` + `fetch` debouncé → route API,
  avec indicateur « Enregistré ✓ ». Cf. `PersonnelEditor`, `ReferentielEditor`, `MatrixGrid`.
- ⚠️ **Un `<select>` contrôlé dans un composant client ne se sérialise pas de façon
  fiable** dans un `<form action={serverAction}>` parent. Pour une grille éditable,
  poster explicitement en JSON vers une route API (cf. `/api/ordonnancement/semaine-type`).
- ⚠️ **Jamais d'`<input type="color">`** : la boîte de dialogue OS fait planter le
  navigateur ici. Utiliser une palette de pastilles (`TeamColorPicker`).
- ⚠️ **Bouton à fond clair = poser aussi `color`** : le style global `button` impose
  `color: var(--primary-text)` (blanc) → un bouton qui passe son `background` en blanc
  devient un bouton « vide » (texte blanc sur blanc). Cf. `tasks/lessons.md` L11.
- **Bouton « + Bilan » rose** (`#e11d48`, couleur du menu Bilans) : classe partagée
  `persongrid.module.css .bilanToggle`, utilisée par Matrice et Habilitations ; le Planning
  reprend le même style en inline.
- **Filtres** : `.filterrow` (label + segments), navigation en `useTransition`.
  Planning : ordre **Quart / Atelier / Équipe**.
- **Modales** : overlay `position:fixed` + `.card` (`TempsPartielModal`, `LegendeModal`,
  `HabLegendeModal`, modale MàJ des habilitations).
- **Ne pas rogner les libellés** : préférer une colonne plus large à un `text-overflow`.
- `ToggleSwitch` partagé. **`prefetch={false}`** sur tout lien répété en liste.

## Performance (état : bon, ~300 ms à chaud — ne pas régresser)
Acquis à préserver : région `cdg1` + Fluid Compute · options de `<select>` construites
**à l'ouverture seulement** (planning) · `prefetch={false}` · cache des données de
référence (`src/lib/refdata.ts`, `unstable_cache` 30 s) · `loading.tsx` sur les gros écrans ·
compteurs du bilan matrice agrégés **en une passe** (`useMemo`, pas un balayage par cellule).

⚠️ **Plafond connu** : `/matrice` sans filtre atelier construit **~22 000 cellules**
(268 personnes × 82 postes), chacune un `<button>` + un `<svg>` ; le HTML dépasse 1,8 Mo
et l'hydratation devient très lourde. Les habilitations sont dans le même ordre de grandeur
(231 × 31). La **virtualisation** des grandes grilles est la seule sortie — c'est le
prochain gros chantier, pas une optimisation cosmétique.

## Carte des fichiers
- Socle : `src/lib/{permissions,roles,current-user,week,refdata,habilitations,supabase-server,fetch-all}.ts`, `src/proxy.ts`.
- Nav : `src/components/{AppHeader,SettingsMenu,UserMenu,ToggleSwitch,NavIcons}.tsx`.
  Logo → `/` (page d'accueil : logo centré + titre « planning »).
- Grille partagée : `src/components/{persongrid.module.css,usePersonGrid.ts}`.
- Planning : `src/app/planning/{page,PlanningGrid,PlanningFilters,AtelierFilter,QuartSelector}.tsx`.
- Placement (saisie glisser-déposer, adossée au droit `planning`) : `src/app/placement/{page,PlanningBoard→PlacementBoard,placement.module.css}` ;
  plan schématique auto-généré (postes par ligne) + liste des noms + absences ; écrit via `/api/placement/cell` (même table que le planning). Aide à la compétence (matrice) en surbrillance. V2 prévue : vrai plan géographique (image + positions).
- Matrice : `src/app/matrice/{page,MatricePanel,MatrixGrid,Pie,LegendeModal}.tsx` + `matrice.module.css`
  (ce qui lui est propre : accent de mode, lignes de bilan, cellule éditable).
- Personnel : `src/app/personnel/*` + `src/app/api/personnel/route.ts`.
- Référentiel : `src/app/admin/referentiel/*` + `src/app/api/referentiel/route.ts`.
- Habilitations : `src/app/habilitations/{page,HabilitationsList,HabMark,HabLegendeModal}.tsx`
  + `src/app/admin/habilitations-param/*`.
- Bilans : `src/app/bilans/*` (Cockpit + 4 catégories, impression PDF via `@media print`).
- Affichage TV : `src/app/affichage/atelier/[atelier]/page.tsx` (public, refresh 60 s).
- Migrations : `supabase/migrations/0001..0031`.
