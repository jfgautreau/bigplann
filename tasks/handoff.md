# Passation BigPlann' (planning usine) — état au 2026-06-19

> Fichier de reprise après `/clear`. À lire en début de session.

## Projet & emplacements
- **Repo de travail : `C:\dev\planning-usine`** (app usine « BigPlann' »). Tout le code vit ici.
- Git : remote `github.com/jfgautreau/bigplann`, branche **main**. **Push = déploiement Vercel auto.**
- Stack : **Next.js 16 (App Router, RSC + server actions)**, React 19, TypeScript, **Supabase** (Postgres + Auth + RLS).

## Base de données / Supabase
- Projet Supabase : ref **`stcxlsmmnplxpirrnefm`**, région **eu-west-3 (Paris)**.
- ⚠️ **Le MCP Supabase est sur un AUTRE compte** → il ne voit pas ce projet. Pour modifier la base : **donner du SQL** à exécuter par l'utilisateur (Supabase → SQL Editor), ou script Node local lisant `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`.
- **Migrations** : `supabase/migrations/`, **appliquées manuellement** par l'utilisateur. **Dernière appliquée : `0025`** (0020→0025 toutes confirmées « faite »).
  - `0020` personne.atelier_id · `0021` Lot C (quart journee, equipe.quart_fixe, poste.categorie, poste_quart, horaire_exception) · `0022` personne.sexe (H/F) · `0023` table `absence` + placement.absence_id · `0024` personne.numero_badge + date_livret_accueil + contrat_periode.motif · `0025` temps partiel (personne.temps_partiel/tp_type/tp_config jsonb).

## Git / déploiement (workflow qui marche)
- Commit via Bash heredoc : `git commit -m "$(cat <<'EOF' … EOF)"`. Trailer : `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. **Auteur = `jf.gautreau@gmail.com`** (config locale, NE PAS forcer un email no-reply → bloque les déploiements Vercel Hobby).
- Toujours `npm run build` (et `npx tsc --noEmit`) avant de committer.
- **Vercel** : région des functions = **`cdg1` (Paris)** forcée via `vercel.json` (`regions`) + `preferredRegion` dans `layout.tsx`. **Fluid Compute = ON** (réduit les cold starts ; activé par l'utilisateur). Pour redéployer sans changement : commit vide `git commit --allow-empty`.

## Modèle métier clé
- **Quart ≠ Équipe** : quarts `journee`/`matin`/`apres_midi`/`nuit` (table `quart`). Équipes tournent par semaine (`equipe_quart_semaine`) sauf `equipe.quart_fixe`. Défaut planning = `matin`.
- **poste.categorie** ∈ manager/conducteur/operateur (source des bilans). `est_conducteur` déprécié.
- **poste_quart** : activation poste×quart, défaut actif (ne stocke que désactivations).
- **horaire_poste** : clé (poste_id, quart_code, jour 0-6).
- **horaire_exception** (personne×jour) : surcharge horaire à l'affichage. Saisie : bouton 🕐 dans la case planning + écran `/horaires-specifiques`.
- **Absences longues** (`absence`) : personne + motif + date_debut..date_fin → matérialisées en `placement` (un/jour, `motif_absence_id`) liés par `placement.absence_id` (cascade). Écran `/absences-specifiques` (lien menu planning 🤒), API `/api/absence`.
- **Temps partiel** (`tp_config` jsonb, options cumulables) — modale `TempsPartielModal` (API `/api/personnel` op `tp`) :
  - `demi` : `{ mode: matin|aprem|tournant, source: quart|horaires, matin?/aprem?: {dow:{debut,fin}} }`. Fixe matin/aprem → planning affiche **« → Mat / → Apr »** sur l'autre quart (`tpRedirect`). Tournant → suit le quart du placement.
  - `off` : `{ dow: ["matin","aprem"] }` demi-journées non travaillées → case **« TP »** bloquée (`tpBlocked`).
  - `horaires` : `{ dow: {debut,fin} }` horaires journée entière.
  - Affichage TV `horaireTxt` priorité : **exception ponctuelle > TP (demi puis journée) > standard**. Planning : `tpBlocked`/`tpRedirect` calculés serveur (selon quart) et passés à `PlanningGrid`.
- **personne** : statut ACTIF/PARTI, type_contrat CDI/CDD/INTERIM, sexe H/F, numero_badge, date_livret_accueil, atelier_id. Contrats multiples dans `contrat_periode` (motif inclus).
- **Permissions** : `lib/permissions.ts` (MODULES, getPermissions, canRead/canWrite, requireModule). Écriture référentiel/personnel = admin.

## Navigation (AppHeader)
- **Menu principal** (`MAIN_ORDER`) avec pastille colorée + icône (`NAV_TILE` + `NavIcon`) : **Référentiel** (vert, icône usine) → Personnel (bleu) → Matrice (violet) → Ordonnancement (orange) → Planning (teal) → Bilans (rose).
- Logo « BigPlann' » → **`/bilans`** (Cockpit).
- **Engrenage** (`SettingsMenu`) = reste des modules admin : Équipes, Compétences, Motifs, Horaires, Affichage, Journal, RGPD, **Rotation des équipes**, Droits.
- 🔔 cloche = habilitations à recycler (compteur ≤ 90 j).

## Patterns UI maison
- **Édition inline auto-enregistrée** (useState + fetch debounce → API ; indicateur Enregistré ✓). Voir `PersonnelEditor`, `ReferentielEditor`, `MatrixGrid`.
- **Listes en 2 tableaux** (Personnel, Planning, Matrice) : un 1er tableau **figé** (filtres + en-têtes + bilan rétractable) et un 2e **scrollable** (les lignes/noms, hauteur limitée). Colonnes alignées via **colgroup commun** + `table-layout: fixed` + `scrollbar-gutter: stable`. **Pas de défilement horizontal** (largeurs en % ; colonne noms en px adaptée au plus long nom).
- **Filtres** : `.filterrow` (label + segments) ; planning = 2 colonnes alignées (Année/Mois/Semaine | Équipe/Atelier/Quart). Filtres en **`useTransition`** (l'UI ne gèle pas, opacité pendant le chargement).
- **Bilan rétractable** : bouton « − Bilan / + Bilan » (planning & matrice).
- **Options de `<select>` à la demande** (planning) : la case ne rend que sa valeur ; la liste complète (postes+motifs) n'est construite qu'à l'ouverture (`onMouseDown`/`onFocus`, state `openKey`).
- **Modales** : overlay `position:fixed` + `.card` (TempsPartielModal, ContratsModal, LegendeModal).
- **ToggleSwitch** partagé (24px). **`prefetch={false}`** sur les liens répétés en liste (sinon Next précharge des centaines de pages).

## Bilans CODIR (`/bilans`)
- `/bilans` = **Cockpit** (KPIs + cartes). Catégories : `/bilans/personnel`, `/bilans/polyvalence`, `/bilans/couverture`, `/bilans/anticipation`. Composant `Bars` partagé. Styles `.kpi/.report-*/.navcard/.barrow` + `@media print` (PDF). `OrdoMonthNav` pour la nav mensuelle. Filtre atelier : `ReportAtelierFilter`.

## Perf (état : bon — ~300 ms à chaud, ~1,3 s → réglé)
Causes traitées : (1) **région cdg1** (latence), (2) **Fluid Compute ON** (cold starts), (3) **options de case à la demande** (supprime ~110k `<option>` du planning), (4) **`prefetch={false}`** (fin du flood de préchargements), (5) **cache des données de référence** (`lib/refdata.ts` : ateliers/équipes/quarts/motifs/niveaux via `unstable_cache` revalidate 30 s, client service), (6) **Personnel en 1 vague** de requêtes, (7) `loading.tsx` (planning/matrice/personnel/bilans).
- En réserve si besoin : **virtualisation** des grandes grilles (planning « Tous », matrice « Tous », personnel) pour passer ~300 → ~150 ms.

## Fichiers importants
- `src/lib/{week,permissions,roles,refdata,supabase-server}.ts`.
- `src/components/{AppHeader,SettingsMenu,UserMenu,ToggleSwitch,PlanningNav,WeekNav,NavIcons,PrintButton}.tsx`.
- Planning : `src/app/planning/{page,PlanningGrid,PlanningFilters,AtelierFilter,QuartSelector,loading}.tsx`.
- Matrice : `src/app/matrice/{page,MatricePanel,MatrixGrid,MatriceFilters,Pie,LegendeModal,loading}.tsx`.
- Personnel : `src/app/personnel/{page,PersonnelEditor,PeriodesEditor,TempsPartielModal,ContratsModal,[id]/page,actions,loading}.tsx` + `src/app/api/personnel/route.ts`.
- Référentiel : `src/app/admin/referentiel/{page,ReferentielEditor}.tsx` + `src/app/api/referentiel/route.ts`.
- Horaires/Absences spé : `src/app/{horaires-specifiques,absences-specifiques}/*` + `src/app/api/{horaire-exception,absence}/route.ts`.
- Affichage TV : `src/app/affichage/atelier/[atelier]/page.tsx`.
- Bilans : `src/app/bilans/{page,Bars,ReportAtelierFilter,personnel,polyvalence,couverture,anticipation,competences}/…`.
- Migrations : `supabase/migrations/0001..0025`.

## Points ouverts / à recaler selon écran
- Sticky/offsets : `--appbar: 40px`, matrice `top:25` postes, planning hauteurs — à ajuster si chevauchement.
- Largeur colonne noms planning = `nb caractères × 7,2px` (plafond 300).
- Règle alerte « > 18 mois » : depuis le début de contrat le plus ancien jusqu'à fin/aujourd'hui, hors CDI.
