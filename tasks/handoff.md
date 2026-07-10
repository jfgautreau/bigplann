# Détail métier & patterns — BigPlann'

> **Ne pas lire d'office.** Les règles de travail, la stack, les permissions et les pièges
> tiennent dans **`CLAUDE.md`** (chargé automatiquement). Ce fichier est la couche de
> détail : à consulter quand on touche précisément un des sujets ci-dessous.
>
> État au 2026-07-10 · migrations appliquées jusqu'à **0029**.

## Migrations récentes (rappel)
`0020` personne.atelier_id · `0021` Lot C (quart `journee`, `equipe.quart_fixe`,
`poste.categorie`, `poste_quart`, `horaire_exception`) · `0022` personne.sexe ·
`0023` table `absence` + `placement.absence_id` · `0024` personne.numero_badge +
date_livret_accueil + contrat_periode.motif · `0025` temps partiel
(`tp_config` jsonb) · `0026` ordre_affichage · `0027` matrice restriction ·
`0028` semaine-type profils · `0029` paramétrage des habilitations.

## Temps partiel (`personne.tp_config`, jsonb, options cumulables)
Modale `TempsPartielModal`, API `/api/personnel` op `tp`.
- `demi` : `{ mode: matin|aprem|tournant, source: quart|horaires, matin?/aprem?: {dow:{debut,fin}} }`.
  Fixe matin/aprem → le planning affiche **« → Mat / → Apr »** sur l'autre quart (`tpRedirect`).
  Tournant → suit le quart du placement.
- `off` : `{ dow: ["matin","aprem"] }` demi-journées non travaillées → case **« TP »**
  bloquée (`tpBlocked`).
- `horaires` : `{ dow: {debut,fin} }` horaires journée entière.

`tpBlocked` / `tpRedirect` sont calculés **côté serveur** (selon le quart) puis passés à
`PlanningGrid`. Priorité d'affichage de l'horaire (TV) :
**exception ponctuelle > temps partiel (demi puis journée) > standard**.

## Planning
- Filtres, dans l'ordre : **Quart / Atelier / Équipe**. Choisir un quart auto-sélectionne
  l'équipe de la rotation de la semaine (`equipe_quart_semaine`, sinon `equipe.quart_fixe`) ;
  le filtre Équipe permet de forcer une autre équipe. Si aucune équipe n'est associée au
  quart, l'équipe est laissée vide (toutes les personnes).
- Panneau d'affectation (`.cellpick`) : ateliers en colonnes côte à côte, **sans ascenseur** ;
  les ateliers longs (≳ 7 lignes, ex. CONDI) sont répartis sur jusqu'à **3 colonnes**.
- Les options de case ne sont construites qu'à l'ouverture (`onMouseDown`/`onFocus`,
  state `openKey`) : indispensable, sinon ~110k `<option>` dans le DOM.
- Largeur de la colonne noms = `nb caractères × 7,2 px` (plafond 300).

## Matrice de polyvalence
- Bilan **plié par défaut** (bouton « + Bilan / − Bilan »).
- Bascule **Actuel / Cible** = interrupteur qui slide, aligné à droite dans la barre de
  filtres (bleu = actuel, vert = cible). Légende à droite, sur la ligne de recherche.
- Noms de poste en en-tête : verticaux, **sur une seule ligne** (`white-space: nowrap`).
- Saisie : clic = +1, clic droit = −1, cycle `0→1→2→3→4→❌ (restriction)→0`.

## Habilitations
- Grille personne × formation (pastilles) ou vue liste. Recherche **multi-critères** :
  si la saisie matche des personnes on filtre les lignes, si elle matche des formations
  on filtre les colonnes.
- La mise à jour se fait dans une **modale** ouverte par le bouton « MàJ ».
- Formation sans durée de validité → échéance affichée « **-** ».
- Paramétrage dans `/admin/habilitations-param` (📜), trié par **ordre d'affichage**.

## Navigation (AppHeader)
- **Menu principal** (`MAIN_ORDER`) avec pastille colorée + icône (`NAV_TILE` + `NavIcon`) :
  Référentiel (vert) → Personnel (bleu) → Matrice (violet) → Ordonnancement (orange) →
  Planning (teal) → Bilans (rose).
- Logo « BigPlann' » → **`/`** (accueil : logo centré + titre « planning »).
- **Engrenage** (`SettingsMenu`) : Équipes, Compétences, Param. Habilitation, Motifs,
  Horaires, Affichage, Journal, RGPD, Rotation des équipes, Droits.
- 🔔 cloche = habilitations à recycler (compteur ≤ 90 j).

## Bilans CODIR (`/bilans`)
`/bilans` = **Cockpit** (KPIs + cartes). Catégories : `/bilans/personnel`,
`/bilans/polyvalence`, `/bilans/couverture`, `/bilans/anticipation`. Composant `Bars`
partagé. Styles `.kpi / .report-* / .navcard / .barrow` + `@media print` (export PDF).
`OrdoMonthNav` pour la navigation mensuelle, `ReportAtelierFilter` pour le filtre atelier.

## Performance — ce qui a été gagné (ne pas régresser)
~1,3 s → ~300 ms à chaud. Causes traitées : (1) région **cdg1**, (2) **Fluid Compute ON**,
(3) options de case **à la demande**, (4) **`prefetch={false}`** sur les liens de liste,
(5) cache des données de référence (`lib/refdata.ts`, `unstable_cache` 30 s),
(6) Personnel en **une vague** de requêtes, (7) `loading.tsx` sur planning/matrice/
personnel/bilans.
En réserve : **virtualisation** des grandes grilles (~300 → ~150 ms).

Redéployer sans changement de code : `git commit --allow-empty`.

## Points ouverts / à recaler selon écran
- Sticky/offsets : `--appbar: 40px`, matrice `top:25` pour les postes — à ajuster en cas
  de chevauchement.
- Règle d'alerte « > 18 mois » : depuis le début du contrat le plus ancien jusqu'à la fin
  (ou aujourd'hui), hors CDI.
- Les enregistrements `personne_competence` créés avant le paramétrage d'une durée de
  validité gardent une `date_expiration` nulle : l'affichage la recalcule, mais un
  backfill SQL reste à faire si on veut assainir la base.
