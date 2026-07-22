# Détail métier & patterns — Polaris

> **Ne pas lire d'office.** Les règles de travail, la stack, les permissions et les pièges
> tiennent dans **`CLAUDE.md`** (chargé automatiquement). Ce fichier est la couche de
> détail : à consulter quand on touche précisément un des sujets ci-dessous.
>
> État au 2026-07-23 · migrations appliquées jusqu'à **0033**.
>
> Dernier chantier : **application stricte de la matrice des droits** (plus aucun rôle en
> dur), **numéros de rotation** et **habilitations exigées par poste** sur `/placement`,
> **mot de passe par lien** sur `/admin/users`, en-tête commun aux trois écrans de gestion.
> Avant : écran `/placement` et **rotation par référence datée** (`rotation_reference`). Avant : ossature de page partagée
> (`.pagecol` / `.headband` / `.gridband`), grille « personnes × colonnes » mutualisée entre
> Matrice et Habilitations, pagination des lectures Supabase (`fetchAll`).

## Migrations récentes (rappel)
`0020` personne.atelier_id · `0021` Lot C (quart `journee`, `equipe.quart_fixe`,
`poste.categorie`, `poste_quart`, `horaire_exception`) · `0022` personne.sexe ·
`0023` table `absence` + `placement.absence_id` · `0024` personne.numero_badge +
date_livret_accueil + contrat_periode.motif · `0025` temps partiel
(`tp_config` jsonb) · `0026` ordre_affichage · `0027` matrice restriction ·
`0028` semaine-type profils · `0029` paramétrage des habilitations ·
`0030` `rotation_reference` (rotation par référence datée) ·
`0031` `audit_trigger` : auteur en repli sur `created_by` / `auteur_app_user_id`
quand `auth.uid()` est null (écritures service role) ·
`0032` `poste.numero_rotation`, table `poste_competence_requise` (habilitations exigées
par un poste), `placement.forcage_*` (traçabilité d'un placement forcé) ·
`0033` `placement.numero_rotation` (place occupée sur le poste).

## Écran Placement (`/placement`) — V1
Saisie « un jour / un quart » par glisser-déposer. ⚠️ **Placement est désormais un module
de droits à part entière** (`MODULES`, entrée normale de `MAIN_ORDER`) : l'injection en dur
dans `AppHeader` a disparu. Sa page exige `write` — c'est un écran de saisie —, donc
l'entrée de menu suit l'écriture et non la lecture.
- **Écrit dans `placement`** via `/api/placement/cell` (même route que le planning) → lien
  automatique avec planning, bilans et affichage TV. Aucune table nouvelle.
- Plan **schématique auto-généré** (postes de l'atelier groupés par ligne) = zones de dépôt
  avec `présents/requis`. La **V2** prévue est un vrai plan géographique (image d'atelier
  importée + position x/y des postes) → nécessitera une migration + un écran de calibrage.
- Liste de droite : tout le personnel actif, **pré-filtrée sur l'équipe qui tourne ce quart
  ce jour** (rotation, cf. `defaultEquipeId`), regroupée *à placer → absents → sur poste →
  autre quart*.
- **Aide à la compétence** : au glissement, postes compatibles en vert, restrictions
  (`matrice` = -1) en rouge, insuffisants grisés.
- `/api/placement/copy` : copie les affectations poste d'un jour vers un autre, même quart,
  en **deux modes** — `ecraser` (défaut) ou `completer`, qui ne touche à aucune personne
  déjà saisie ce jour-là, poste **comme** absence. Le mode est appliqué côté serveur.
- ⚠️ `placement` est unique par **(personne, jour)** : une personne ne peut être que sur un
  quart par jour. `/api/placement/cell` renvoie **409** si on la pose sur un autre quart ;
  le board la libère d'abord (delete puis upsert).
- Le board est **keyé** sur `atelier|jour|quart` : il remonte à chaque changement de filtre,
  ce qui réinitialise proprement l'état local depuis les props serveur.
- **Lignes fermées** : le plan applique désormais `jour_quart` / `ouverture_quart` comme le
  Planning (cf. CLAUDE.md pour l'asymétrie des défauts). Une semaine non initialisée donne
  donc un plan **vide**, accompagné d'un message qui renvoie vers l'Ordonnancement.
- **Cases numérotées** : `poste.numero_rotation` développé par `parseNumeros()` ; les places
  au-delà des numéros saisis, et les postes non numérotés, gardent une zone « sans numéro ».
- **Couleurs d'alerte** : sureffectif → toute la tuile en orange ; compétence sous le minimum
  du poste → pastille rouge ; habilitation manquante ou périmée → rouge **encadré**, pour
  rester distinguable du simple manque de niveau.
- **Vue Absences** : `SlideSwitch` Plan / Absences (`?vue=absences`), une carte par motif,
  filtrée par l'atelier affiché ; les personnes sans atelier renseigné restent visibles.
- **Bouton PDF** : feuille A4 paysage (en-tête atelier · quart · date · couverture, plan à
  gauche, absents à droite), mise à l'échelle **mesurée** — cf. `tasks/lessons.md` L16.

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
  l'équipe de la rotation de la semaine (calculée par `rotationForWeek()` depuis
  `rotation_reference`, sinon `equipe.quart_fixe`) ; le filtre Équipe permet de forcer une
  autre équipe. Si aucune équipe n'est associée au quart, l'équipe est laissée vide
  (toutes les personnes).
- Panneau d'affectation (`.cellpick`) : ateliers en colonnes côte à côte, **sans ascenseur** ;
  les ateliers longs (≳ 7 lignes, ex. CONDI) sont répartis sur jusqu'à **3 colonnes**.
- Les options de case ne sont construites qu'à l'ouverture (`onMouseDown`/`onFocus`,
  state `openKey`) : indispensable, sinon ~110k `<option>` dans le DOM.
- Largeur de la colonne noms = `nb caractères × 8 px + 46` (plancher 160, plafond 480) et
  **pas de troncature** : les noms complets doivent tenir (cf. règle « ne pas rogner »).
- Pendule 🕐 (horaire spécifique, table `horaire_exception`) : disponible sur une case
  affectée, sur le motif **Formation** (sélectionner Formation ouvre la pendule pour saisir
  le sujet), et tant qu'une exception subsiste même sans affectation. Le champ libre est
  un **commentaire** (colonne `motif` réutilisée) **affiché sur la TV**. L'infobulle propose
  l'**horaire par défaut** (`horaire_poste` du quart/jour).
- Flèche `»` de recopie : lundi→jeudi = fin de la semaine en cours ; **à partir du vendredi**
  = les jours affichés de la **semaine suivante** (une seule).

## Matrice de polyvalence
- Bilan **plié par défaut** (bouton « + Bilan / − Bilan »). Ses 9 lignes sont alimentées
  par **une seule passe** `useMemo` sur personnes × postes, pas par un balayage par cellule.
- Bascule **Actuel / Cible** = interrupteur qui slide, aligné à droite dans le bandeau de
  filtres (bleu = actuel, vert = cible). Recherche **centrée**, légende à droite.
- Noms de poste en en-tête : verticaux, **sur une seule ligne** (`white-space: nowrap`).
  Ils répètent le nom de leur ligne (« Conducteur Thermo 1 » sous « Thermo 1 »), ce qui
  impose une bande d'en-tête de 170 px. Retirer ce suffixe à l'affichage a été **écarté**
  par l'utilisateur (2026-07-10) : la règle naïve « se termine par le nom de la ligne » ne
  couvre que 38 des 82 postes et produirait un rendu incohérent.
- Saisie : clic = +1, clic droit = −1, cycle `0→1→2→3→4→❌ (restriction)→0`.
  ⚠️ Non découvrable et impossible au tactile (pas de clic droit) ; la cible du clic fait
  28 px, sous le seuil de confort tactile. Un popover de choix reste à faire si besoin.
- La grille elle-même vient du module partagé (cf. `CLAUDE.md`), pas de code local.

## Habilitations
- **Même grille que la matrice**, au composant près (`persongrid.module.css`,
  `usePersonGrid`). Deux pages distinctes parce que les droits d'écriture diffèrent :
  `chef_equipe` écrit dans la matrice, pas dans les habilitations.
- Vue **Grille** (pastilles) ou **Liste** : `SlideSwitch` en ligne 2 de l'en-tête, là où la
  matrice a sa bascule Actuel/Cible. Le bouton « MàJ » **n'existe plus**.
- Pastille de 28 px comme la matrice. « Non habilité » = **cercle vide**, exactement comme
  le niveau 0 : un cercle vide veut dire « rien » dans les deux écrans.
- Accent des en-têtes **neutre** (gris) : sur la matrice la couleur encode le mode
  Actuel/Cible ; ici il n'y a pas de mode, et l'ambre de la tuile de nav se confondrait
  avec la pastille orange « bientôt dépassée ».
- Les en-têtes de formation ne sont **plus rognés** (ils l'étaient à 112 px). La plus
  longue (« Gestion de crise - Retrait / Rappel », 35 car.) porte la bande d'en-tête à
  243 px, contre 170 px sur la matrice.
- Légende = modale `HabLegendeModal`, ouverte depuis la ligne 1 de l'en-tête.
- Recherche **multi-critères** : si la saisie matche des personnes on filtre les lignes,
  si elle matche des formations on filtre les colonnes.
- La saisie s'ouvre **au clic sur une pastille** de la grille (`HabMajModal`), pré-remplie
  avec la personne, la formation et la date du jour ; sur une case déjà remplie, elle
  rappelle le dernier passage et enregistre un recyclage. Elle poste vers
  `/api/habilitations` : un composant client ne peut pas pré-remplir un
  `<form action={serverAction}>`.
- Filtres **Atelier / Équipe** identiques à la matrice (`AtelierEquipeFiltres`, portés par
  l'URL) ; la vue Liste suit le même périmètre que la grille.
- Les **compteurs globaux** sont dans la cellule d'angle du tableau, au-dessus du bouton
  Bilan. Le marqueur « autorisation de conduite » est un **volant blanc sur pastille bleue**
  (`AutorisationMark`) : l'emoji apparaissait à l'envers dans les en-têtes en écriture
  verticale, et le bleu ne porte aucun statut ici, contrairement au vert ou à l'orange.
- Formation sans durée de validité → échéance affichée « **-** ».
- Paramétrage dans `/admin/habilitations-param`, atteint par un lien texte dans le bandeau.

## Navigation (AppHeader)
- **Menu principal** (`MAIN_ORDER`) avec pastille colorée + icône (`NAV_TILE` + `NavIcon`) :
  Référentiel (vert) → Personnel (bleu) → Matrice (violet) → Ordonnancement (orange) →
  Planning (teal) → Bilans (rose).
- Logo « Polaris » → **`/`** (accueil : logo centré + titre « planning »).
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
(8) `fetchAll()` fait **deux** allers-retours au lieu d'un sur `matrice` : c'est le prix
de l'exactitude (cf. `lessons.md` L8), négligeable devant le rendu.

⚠️ **Plafond structurel** : `/matrice` sans filtre atelier construit ~22 000 cellules
(268 × 82), HTML de 1,8 Mo, hydratation très lourde — dans un navigateur headless elle ne
se termine pas. `/habilitations` est du même ordre (231 × 31 = 7 200 cases).
La **virtualisation** des grandes grilles n'est plus une optimisation « en réserve » mais
le prochain chantier nécessaire.

Redéployer sans changement de code : `git commit --allow-empty`.

## Points ouverts / à recaler selon écran
- Sticky/offsets : `--appbar: 40px`. Les rangées d'en-tête collantes se règlent par
  `--sub-top` / `--col-top` sur `.grid` (matrice : 25 px, habilitations : 22 et 44 px).
- Cible de clic de la matrice à 28 px : à élargir à toute la cellule si la saisie passe
  un jour sur tablette.
- Enregistrement d'une cellule de matrice : l'état local est **optimiste** et l'indicateur
  « Enregistré » s'affiche en haut du panneau, hors champ quand on édite en bas de liste.
  Un retour à la cellule + rollback en cas d'échec reste à faire.
- Règle d'alerte « > 18 mois » : depuis le début du contrat le plus ancien jusqu'à la fin
  (ou aujourd'hui), hors CDI.
- Les enregistrements `personne_competence` créés avant le paramétrage d'une durée de
  validité gardent une `date_expiration` nulle : l'affichage la recalcule, mais un
  backfill SQL reste à faire si on veut assainir la base.

### Reste à faire (au 2026-07-16)
- **Placement V2** : vrai plan géographique (image d'atelier importée + position x/y des
  postes, écran de calibrage) → migration à prévoir. La V1 schématique est en place.
- Placement : finitions proposées **non retenues pour l'instant** — slots visuels ○○○ pour
  les postes multi-personnes, légende du code couleur de compétence, et allègement du badge
  « à placer » répété.
- Placement : masquer les lignes fermées un jour donné (`ouverture_quart` / `jour_quart`).
- Journal : les tables sans colonne d'auteur (ex. `personne`) restent en « Système ». Pour
  couvrir tout, il faudrait transmettre l'utilisateur au trigger (en-tête lu côté base) —
  choix « universel » écarté au profit du « ciblé » (cf. L12).
- ⚠️ **Aucun écran n'a pu être vérifié visuellement par l'agent** (pages protégées par
  login) : tout est validé par `npm run build` + tests. Les retours visuels viennent de
  l'utilisateur (c'est ainsi qu'on a trouvé L11).
- Chantier de fond toujours ouvert : **virtualisation** des grandes grilles
  (matrice ~22 000 cellules) — cf. CLAUDE.md § Performance.
