# Polaris — brief agent

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
   Projet Supabase : ref `stcxlsmmnplxpirrnefm`, eu-west-3. **Dernière migration appliquée : `0039`.**
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
- 🚫 **Plus aucun `role === "admin"` en dur.** La matrice décide seule ; l'admin obtient
  tout parce qu'elle le lui donne (`defaultsFor("admin")`). Un droit accordé dans l'écran
  doit fonctionner : sinon on offre un bouton qui répond 403 (bug vécu sur la fusion de
  personnes et sur les server actions de Compétences / Motifs / Personnel).
  - Server actions et routes de paramétrage → `requireModuleWrite(mod)`
    (vérifie la matrice **et** rend le client admin, ces tables étant sous RLS `is_admin()`).
    Variante **route API** : `moduleWriteGuard(mod)` → `{ ok, supabase }` ou `{ ok:false, status }`.
  - ⚠️ **Une route qui écrit dans une table de paramétrage ne doit JAMAIS se contenter
    de `getServerClient()`.** Ces RLS nomment des rôles en dur (`is_admin()`,
    `has_role('ordo')`) : tout titulaire du droit qui ne porte pas ce rôle est refusé
    **en silence**, et l'écran offre un bouton qui répond 403. Bug vécu sur les 6 routes
    d'ordonnancement (un CODIR ne pouvait pas initialiser les semaines) et sur `/api/droits`.
  - Table `placement` : écrite par **deux** écrans (Planning et Placement) via
    `/api/placement/cell` → `canWritePlacementData()` = write sur l'un **ou** l'autre.
  - Restent volontairement en dur : les droits par défaut de l'admin (`defaultsFor`) ;
    l'exclusion du chef d'équipe ci-dessus, qui est un **périmètre**, pas un droit de
    module. Un test (`routes-gardees.test.ts`) échoue si un `role === "admin"`
    réapparaît dans une route API.
- **Anti-escalade — `droitsCouvertsPar(role, appelant)`** : « on ne donne pas ce qu'on
  n'a pas ». Vrai si les droits de `role` ne dépassent **nulle part** ceux de l'appelant,
  calculé sur la matrice — aucun nom de rôle en dur. Sans cela, un titulaire de
  `utilisateurs: write` créait un compte, le nommait admin, récupérait son **lien de mot
  de passe affiché en clair** et s'y connectait. Les 4 routes `/api/users/*` passent par
  `userAdminGuard({ cibleUserId, roleVise })`, qui vérifie le droit **et** l'escalade dans
  les deux sens (promotion *et* rétrogradation d'un compte qui vous domine).
  ⚠️ Conséquence assumée : déléguer `utilisateurs: write` à un rôle ne lui permet de
  gérer que les comptes dont le rôle est **entièrement couvert** par le sien. C'est le
  prix de « pas d'escalade » : le lien de mot de passe donne la session du compte visé.
- **`/api/droits` (matrice des droits)** obéit à `verifierChangementDroit()`, testée,
  avec trois verrous et **aucun rôle littéral** :
  1. **anti-verrou** — on ne modifie pas les droits de **son propre** rôle (sinon on se
     retire `utilisateurs` et l'écran devient inaccessible à tous) ;
  2. **`ROLE_TOUT_PUISSANT`** — le rôle à qui `defaultsFor` donne `write` partout (donc
     `admin`, mais **déduit**, pas écrit) n'est modifiable par personne, lui compris :
     sa colonne reste visible avec ses droits réels, grisée ;
  3. **anti-escalade** — on n'accorde pas un niveau supérieur au sien sur un module.

  Volontairement **non** couvert : abaisser les droits d'un rôle intermédiaire. Ce n'est
  pas une escalade (l'auteur n'y gagne rien) et c'est tracé au journal depuis la 0036.
  L'interdire supposerait de n'ouvrir que les rôles strictement plus faibles que soi —
  or les rôles ne sont pas ordonnés entre eux, la matrice serait **entièrement grisée**
  pour tout autre qu'un admin (vérifié sur les données réelles).
- **`is_active` est vérifié par `getCurrentProfile()`** (pas seulement par la RLS) :
  un compte désactivé n'a plus de profil, donc plus de navigation.
- **Les 8 écrans de réglage s'ouvrent en LECTURE** (`requireModule(mod, "read")`) et
  passent en consultation seule via `<LectureSeule>` — un `<fieldset disabled>` neutralise
  tous les champs d'un coup. Le menu apparaît dès la lecture. Seul **Placement** fait
  exception : écran de saisie, sa page exige `write`, l'entrée de menu aussi.
- Rôles : `admin`, `chef_equipe`, `ordo`, `rh`, `codir`, `planning`.
- Routes publiques (`src/proxy.ts`) : `/login`, `/forgot`, `/reset`, `/auth/*`, `/affichage/*`.
- **Mot de passe** : l'admin n'en choisit jamais. `/admin/users` génère un **lien**
  `{base}/reset?token_hash=…` à transmettre (aucun e-mail envoyé, le SMTP n'est pas
  garanti). Cf. `src/lib/password-link.ts` et `tasks/lessons.md` L15 — ne pas revenir à
  `action_link`, il ne marche pas ici.

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
- **Ouverture des lignes** (`jour_quart`, `ouverture_quart`) : décidée dans Ordonnancement.
  ⚠️ Asymétrie : un quart **absent** de `jour_quart` est **fermé** (rien n'est ouvert tant
  que la semaine n'a pas été « initialisée ») ; une ligne absente d'`ouverture_quart` est
  **ouverte**. Planning **et** Placement appliquent cette règle — d'où un plan vide, avec
  message explicite, sur une semaine non initialisée.
- **Numéros de rotation** : `poste.numero_rotation`, texte libre saisi au Référentiel
  (« 12, 15-17 »). `parseNumeros()` (`src/lib/numeros-rotation.ts`, testé) le développe en
  cases de dépôt ; la place occupée est mémorisée dans `placement.numero_rotation`.
  Depuis le **Planning** (qui n'a pas de cases), `/api/placement/cell` prend la première
  place libre — mais **seulement si le champ `numero` est absent** de la requête : le
  Placement l'envoie toujours, `null` valant « volontairement hors numéro ».
- **Habilitations exigées par un poste** : `poste_competence_requise`. Placer quelqu'un qui
  ne l'a pas — ou plus — demande confirmation ; le forçage est tracé
  (`placement.forcage_*`) mais le **rouge est recalculé à l'affichage**, il s'efface donc
  dès la régularisation.
- **`poste.categorie`** ∈ manager/conducteur/operateur (source des bilans).
  `est_conducteur` est **déprécié et n'est plus lu nulle part** (colonne conservée en base,
  mais divergente : 9 postes ont `categorie='conducteur'` et `est_conducteur=false`).
  Un test échoue si une lecture réapparaît.
- **Quarts : aucun code en dur.** `src/lib/quarts.ts` porte les deux règles qui étaient
  recopiées partout — le **quart par défaut** d'un écran (`matin` s'il existe, sinon le
  premier dans l'ordre) et le **repli des placements historiques** sans `quart_code`.
  ⚠️ Ces deux règles divergeaient : `/planning` utilisait `quartCodes[0]` (= `journee`,
  ordre 0) là où Placement, TV, copie et `/api/placement/cell` utilisaient `matin` — les
  mêmes lignes s'affichaient sous deux quarts selon l'écran. La migration 0038 a normalisé
  les 7 placements concernés. Un test interdit le retour d'un code de quart en dur.
  Exception documentée : `tp_config` stocke ses demi-journées sous les clés `matin`/`aprem`
  — vocabulaire distinct, à traiter avec le modèle du temps partiel, pas avec les quarts.
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
  **En-tête commun à Personnel / Matrice / Habilitations**, à ne pas réinventer :
  `.hb-l1` (ligne 1 : titre · recherche `.hb-search` · complément `.hb-fin` calé à droite)
  et `.hb-l2` (ligne 2 : bascule ou actions à gauche · filtres `.hb-fin` à droite).
  ⚠️ La recherche vit dans le **composant client** qui porte son état — c'est pourquoi
  l'en-tête de la Matrice et des Habilitations est rendu par leur composant, pas par la page.
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
- La **cellule d'angle** (`.cornerHead`) porte, dans les Habilitations, les compteurs
  globaux (`.cornerKpis`, **une seule colonne** — sur deux, les libellés se font rogner)
  puis le bouton Bilan. La ligne de recherche n'y est plus : elle est montée dans `.hb-l1`.
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
- **Intérim = jaune** (`INTERIM_BG` de `src/lib/interim.ts`) sur Planning, Placement,
  Matrice, Habilitations et TV. Le vert est réservé à « aujourd'hui » sur la TV — les
  deux se distinguent d'un coup d'œil. Un seul endroit pour changer la teinte.
- **Choix d'une plage de dates** : `<DateRangePicker>` (deux mois côte à côte, sélection
  en deux clics, style Booking). La logique est dans `src/lib/calendrier.ts`, testée.
  Utilisé dans la modale Absences ; à reprendre partout où l'on demande *du…au*.
- **Composants partagés — les utiliser plutôt que d'en refaire un :**
  - `SlideSwitch` — bascule **entre deux vues** (Plan/Absences, Actuel/Cible, Grille/Liste).
    ⚠️ Ne pas confondre avec `ToggleSwitch`, qui dit actif/inactif en vert et rouge.
    Sa largeur est **fixe** à dessein : sur une largeur dictée par le contenu, le libellé le
    plus long déséquilibre les deux moitiés et la pastille ne tombe plus en face.
  - `AtelierEquipeFiltres` — filtres Atelier/Équipe en segments, portés par l'URL
    (Matrice **et** Habilitations) ; `base` = la route à repeindre.
  - `LectureSeule` — consultation seule d'un écran de paramétrage (cf. Sécurité).
  - `PageTitle` — titre + pastille du module. `PrintButton` — impression simple.
- `ToggleSwitch` partagé. **`prefetch={false}`** sur tout lien répété en liste.
- ⚠️ **Un libellé posé sur une pastille mobile ne se cible pas par position** :
  `:first-of-type` vise le premier élément **du même type**, souvent la pastille elle-même.
  Poser une classe explicite depuis le composant.
- **Impression** : `@page` A4 paysage et `.noprint` sont déjà dans `globals.css`. Pour
  faire tenir une vue sur une page, cf. `tasks/lessons.md` L16 (`transform: scale()`,
  **jamais** `zoom`) et `ajusterFeuille()` dans `PlacementBoard`.

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
- Socle : `src/lib/{permissions,roles,current-user,week,refdata,habilitations,supabase-server,fetch-all,numeros-rotation,password-link,rotation,password}.ts`, `src/proxy.ts`.
- Nav : `src/components/{AppHeader,SettingsMenu,UserMenu,NavIcons}.tsx`.
  Logo → `/` (page d'accueil : logo centré + titre « planning »).
  `UserMenu` porte aussi le lien vers le **guide utilisateur** (`public/guide.html`,
  document autonome ouvert dans un onglet, mais servi derrière l'authentification).
- Composants partagés : `src/components/{SlideSwitch,AtelierEquipeFiltres,LectureSeule,PageTitle,PrintButton,ToggleSwitch,AutoRefresh,persongrid.module.css,usePersonGrid.ts}`.
- Planning : `src/app/planning/{page,PlanningGrid,PlanningFilters,AtelierFilter,QuartSelector}.tsx`.
- Placement (saisie glisser-déposer, droit **`placement`**) : `src/app/placement/{page,PlacementBoard,placement.module.css}`.
  Plan par ligne → postes → **cases numérotées** ; bascule **Plan / Absences** (`?vue=absences`,
  absences filtrées par l'atelier affiché) ; copie **écraser / compléter** ; bouton **PDF**
  (feuille A4 paysage : plan + colonne des absents, mise à l'échelle mesurée).
  Écrit via `/api/placement/{cell,copy,reset-week}` — même table que le Planning.
  V2 prévue : vrai plan géographique (image + positions).
- Matrice : `src/app/matrice/{page,MatricePanel,MatrixGrid,Pie,LegendeModal}.tsx` + `matrice.module.css`.
  L'en-tête (titre · recherche · légende · bascule Actuel/Cible · filtres) est dans
  `MatricePanel` ; `MatrixGrid` reçoit `search` en prop.
- Personnel : `src/app/personnel/*` + `src/app/api/personnel/{route,merge/route,[id]/export/route,[id]/absences/route}.ts`.
  Colonne **Absences** (calendrier barré) : historique regroupé en périodes, déclaration
  d'une absence, et **départ prévu**. Le regroupement vit dans `src/lib/absences-periodes.ts`
  (testé) : il part des **jours** et non de la table `absence` — 401 des 421 jours sont
  saisis au Planning sans période déclarée. Il enjambe les week-ends (écart ≤ 3 jours) et
  ne réunit jamais deux motifs différents. `date_depart_prevu` ≠ `date_fin`, qui est le
  reflet réécrit automatiquement du contrat le plus récent ; le statut n'est **pas**
  basculé tout seul (aucune tâche planifiée sur ce projet).
  L'en-tête complet est dans `PersonnelEditor` (la page ne rend que `AppHeader`).
- Référentiel : `src/app/admin/referentiel/*` + `src/app/api/referentiel/route.ts`
  (colonnes **N° Rot** et **Habil. requises**).
- Habilitations : `src/app/habilitations/{page,HabilitationsList,HabMark,HabLegendeModal,HabMajModal,AutorisationMark}.tsx`
  + `src/app/admin/habilitations-param/*` + `src/app/api/habilitations/route.ts`.
  Saisie **au clic sur une pastille** (modale pré-remplie) ; l'en-tête est rendu par
  `HabilitationsList`, pas par la page.
- Utilisateurs : `src/app/admin/users/{page,NouvelUtilisateur,UserRoleSelect,UserRowActions,LienMotDePasse,DroitsMatrix}.tsx`
  + `src/app/api/users/{create,role,active,reset-password}/route.ts` + `/api/droits`.
- Bilans : `src/app/bilans/*` (Cockpit + 4 catégories, impression PDF via `@media print`).
- Affichage TV : `src/app/affichage/atelier/[atelier]/page.tsx` (public, refresh 5 min,
  **vue par nom uniquement**).
- Param. RH (ex-« Motifs d'absence », clé de droit toujours `motifs`, route toujours
  `/admin/motifs`) : `src/app/admin/motifs/{page,actions}.ts(x)` — motifs d'absence **et**
  agences d'intérim, ces dernières servant le menu déroulant Agence de `PeriodesEditor`.
- Migrations : `supabase/migrations/0001..0039`.
- **Écritures : lire l'erreur, toujours.** `messageErreur()` (`src/lib/erreurs.ts`) traduit
  les codes Postgres ; les server actions repassent le message par l'URL
  (`urlAvecErreur` → `?err=`) et la page l'affiche via `<BandeauErreur>`. Un test
  (`ecritures-verifiees.test.ts`) échoue si une écriture n'est pas destructurée.
- **Séquences « effacer puis réécrire » → fonction SQL.** `set_rotation_reference`,
  `creer_absence`, `maj_absence` (migration 0037, `SECURITY INVOKER` : le modèle
  d'autorisation est inchangé). En deux requêtes applicatives, un échec de la seconde
  perdait la donnée en silence — la rotation n'est pas reconstituable. Le même test
  interdit le retour au `delete` + `insert` applicatif sur ces tables.
- Tests (Vitest) : règles pures + `permissions.test.ts` (droits par défaut, périmètre du
  chef d'équipe, anti-escalade) et `routes-gardees.test.ts` (inventaire : **toute route
  API porte une garde** — le proxy exclut `api/`, une route nouvelle serait publique —
  et aucun rôle en dur). `vitest.config.ts` résout l'alias `@/`, sans quoi le socle
  n'est pas testable.
