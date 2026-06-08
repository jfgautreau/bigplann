# Passation BigPlann' (planning usine) — état au 2026-06-04

> Fichier de reprise après `/clear`. À lire en début de session.

## Projet & emplacements
- **Repo de travail : `C:\dev\planning-usine`** (app usine « BigPlann' »). C'est ICI que tout le code vit.
- Le dossier `...\AppliSaas\planningmission` est une **autre** app (conseil) — ne pas confondre.
- Git : remote `github.com/jfgautreau/bigplann`, branche **main**.
- Stack : **Next.js 16 (App Router, RSC + server actions)**, React 19, TypeScript, **Supabase** (Postgres + Auth + RLS), déploiement **Vercel auto sur `git push origin main`** (pas de lien CLI vercel local).

## Base de données / Supabase
- Projet Supabase de l'app : ref **`stcxlsmmnplxpirrnefm`** (cf. `NEXT_PUBLIC_SUPABASE_URL` dans `.env.local`).
- ⚠️ **Le MCP Supabase est sur un AUTRE compte** (projets visibles : PlanningMission/Questionnaire/assistant) — il **ne voit pas** `stcxlsmmnplxpirrnefm`. Donc **impossible d'écrire en base via le MCP**.
- Pour modifier la base : soit **donner du SQL** à exécuter par l'utilisateur dans **Supabase → SQL Editor**, soit script Node local lisant `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`.
- **Migrations** : fichiers dans `supabase/migrations/`, **appliquées MANUELLEMENT par l'utilisateur** dans le SQL Editor. **Dernière appliquée : `0019`** (l'utilisateur confirme « 0019 faite » — table `semaine_type_ouverture` : ouverture des lignes par défaut dans la semaine type).

## Gotchas environnement (Windows / PowerShell)
- `git commit -m "..."` avec accents/guillemets **casse le parsing PS**. Méthode qui marche :
  1. Écrire le message dans `COMMIT_MSG.tmp` (à la racine du repo).
  2. `git add src` (PAS `-A`, pour ne pas committer le tmp).
  3. `git commit -q -F COMMIT_MSG.tmp` — ⚠️ **NE PAS forcer l'auteur** avec `-c user.email=...noreply...`. Laisser la config locale (`jfgautreau <jf.gautreau@gmail.com>`). L'ancien override `jfgautreau@users.noreply.github.com` **faisait BLOQUER les déploiements Vercel** (plan Hobby : « commit author did not have contributing access » — cet email no-reply n'est pas relié au compte GitHub/Vercel propriétaire). Le bon email auteur pour déployer = **`jf.gautreau@gmail.com`**.
  4. `Remove-Item COMMIT_MSG.tmp -Force`
  5. `git push origin main` — affiche une **RemoteException / exit 255 inoffensive**, le push réussit quand même (voir la ligne `xxuser -> main`).
- Trailer de commit : `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Toujours `npm run build` avant de committer (vérif TS).
- Déployer systématiquement à la fin d'une tâche (push = déploiement prod).

## Modèle métier clé
- **Quart (shift) ≠ Équipe (team)** : quarts = `matin` / `apres_midi` / `nuit` (table `quart`, libellé « Après-midi » corrigé en 0016). Les équipes tournent par semaine via `equipe_quart_semaine`.
- **Ordonnancement** : `jour_quart` (quart actif un jour) + `ouverture_quart` (ligne ouverte par jour×quart). Défauts : actif sauf dimanche, ouvert par défaut (`lib/week.ts: defaultQuartActif`).
- **`horaire_poste`** : depuis 0016, clé **(poste_id, quart_code, jour 0-6)** — l'horaire est au POSTE par quart (avant : par équipe).
- **Permissions** : `lib/permissions.ts` (MODULES, getPermissions, canRead/canWrite, requireModule). Rôles : `lib/roles.ts`. Écriture référentiel/personnel = **admin** (RLS `is_admin()`).
- Personnes : table `personne` (statut ACTIF/PARTI, type_contrat CDI/CDD/INTERIM, matricule unique nullable auto-INT pour intérim).

## Patterns UI maison
- **Édition inline auto-enregistrée** : composant client qui tient l'arbre/les lignes en `useState`, sauvegarde en `fetch` debounce (500ms texte, 0 pour selects/toggles) vers un endpoint API, indicateur « Enregistré ✓ / Échec ». Voir `ReferentielEditor.tsx` + `/api/referentiel`, `PersonnelEditor.tsx` + `/api/personnel`.
- **ToggleSwitch** partagé : `src/components/ToggleSwitch.tsx` (pilule vert/rouge, cadenas, **24px de haut**). Props `on/onChange/onLabel/offLabel/title`.
- **En-têtes de tableau figés** : classe CSS `.sticky-head` (globals.css) → `thead tr:first-child th` sticky sous la barre d'app (`--appbar: 40px`). La barre d'app `.appheader` est sticky (z-index 50).
  - ⚠️ `position: sticky; top` **ne marche pas** dans un conteneur `overflow:auto` par rapport à la fenêtre. Pour le **planning**, la grille est une **zone à défilement interne** (`maxHeight: calc(100vh - 190px); overflow:auto`) avec en-têtes `top:0` + colonne gauche `left:0`.
- Padding tables réduit globalement à `4px 10px` (globals.css).

## Travaux récents (commits, du + récent au + ancien)
- `bb5b023` **Perf latence serveur/page** : `getUser()`→`getClaims()` (vérif JWT locale, fallback HS256) dans `current-user.ts` ; `React.cache()` sur `getServerClient`/`getCurrentProfile`/`getPermissions` (1 seul contrôle profil+droits par requête) ; requêtes pages parallélisées (matrice 5→2 vagues, planning : `personne`+`equipe_chef` remontés en vague 1) ; `AutoRefresh` → `router.refresh()`.
  - ⚠️ **Pour activer le gain auth** : Supabase Dashboard → *Project Settings → JWT Keys* → migrer vers des **clés asymétriques (RS256/ES256)**. Tant que le projet est en HS256, `getClaims()` retombe sur `getUser()` distant (aucune régression, mais pas de speedup).
  - Pistes non faites (proposées) : P4 `output: "standalone"`, P5 mémoïsation grilles, cache cross-requête des permissions (`unstable_cache` + invalidation dans `droits/actions.ts`), vérif des index DB (`placement(personne_id,jour)`, `matrice(personne_id)`, `ouverture_quart(quart_code,jour)`).
- `ef5018a` Bilan **Compétences disponibles** refondu : regroupé par **catégorie** (Chefs d'équipe / Conducteurs / Opérateurs=tous les autres), cellule `dispo/besoin`, **bordeaux sur fond rouge pâle** si dispo<besoin, jours fermés masqués, séparateurs + en-tête de semaine. Besoin calculé depuis l'ordonnancement.
- `00ad873` Personnel : form création complet rétabli ; ToggleSwitch 24px (tout le site) ; lignes resserrées ; en-têtes figés (perso + planning).
- `9743334` Planning : titre retiré, filtres Équipe/Quart à droite, lignes compactées, cellule « Personne » vidée.
- `b5d55ba` Personnel : éditeur inline + interrupteur Actif/Parti.
- `a87f008` / `544d748` Référentiel : interrupteurs Actif/Inactif + saisie inline.
- `bfa2f90` / `d8697fd` Affichage TV : vues **Par poste** / **Par nom**, horaires sous le nom, respect des fermetures, jours sans travail masqués, anti-chevauchement colonnes.
- `0df3156` Horaires refonte (poste×quart×jour) + **migration 0016**.
- `a9bab37`/`a4ada56`/`3a32956` Passe d'**accentuation** de tout le texte affiché (identifiants/colonnes/routes laissés intacts).
- Insertion **25 personnes** en base via SQL fourni (exécuté par l'utilisateur).

## À vérifier / hypothèses ouvertes (points où l'utilisateur peut demander un ajustement)
- **Bilan compétences** : détection « Chef d'équipe » = ligne nommée `CE` ou poste contenant `CE/Chef`. Besoin Opérateurs basé sur `effectif_requis` du référentiel (souvent 0 → jamais rouge). Besoin Conducteurs = effectif conducteur × lignes ouvertes × quarts. À confirmer avec sa réalité.
- **Sticky headers** : `--appbar: 40px` (estimation) et planning `100vh - 190px` — à recaler si chevauchement/trait blanc selon écran.
- ToggleSwitch sur la colonne « Actif » des **postes** : laissé en case à cocher (table compacte) — proposé de basculer aussi.

## Fichiers importants
- `src/lib/week.ts` (dates/quarts/mois), `src/lib/permissions.ts`, `src/lib/roles.ts`.
- `src/components/{AppHeader,SettingsMenu,ToggleSwitch,PlanningNav,PeriodBand,PrintButton}.tsx`.
- Planning : `src/app/planning/{page,PlanningGrid,PlanningFilters,QuartSelector}.tsx`.
- Référentiel : `src/app/admin/referentiel/{page,ReferentielEditor}.tsx` + `src/app/api/referentiel/route.ts`.
- Personnel : `src/app/personnel/{page,PersonnelEditor,[id]/page,actions}.tsx` + `src/app/api/personnel/route.ts`.
- Horaires : `src/app/admin/horaires/{page,HoraireGrid,actions}.tsx`.
- Affichage TV : `src/app/affichage/atelier/[atelier]/page.tsx`.
- Bilan : `src/app/bilans/{page,competences/page,competences/CompetenceNav}.tsx`.
- Migrations : `supabase/migrations/0001..0016`.
