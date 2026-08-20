# Détail métier & patterns — Polaris

> **Ne pas lire d'office.** Les règles de travail, la stack, les permissions et les pièges
> tiennent dans **`CLAUDE.md`** (chargé automatiquement). Ce fichier est la couche de
> détail : à consulter quand on touche précisément un des sujets ci-dessous.
>
> État au 2026-08-20 · migrations appliquées jusqu'à **0048** · **189** tests Vitest.
>
> **Session 2026-08-19/20 — CHANTIER MULTI-SITE (SaaS multi-tenant)** :
> polaris devient une plateforme, capable d'accueillir plusieurs usines sur la
> même base Supabase. Le socle et le back-office sont livrés en prod, on est en
> **standby** jusqu'à ce qu'un vrai 2e site soit en vue. Le doc complet vit
> dans `tasks/multi-site.md` (« Où on en est » en haut). Résumé :
> - PR 1 (`0043`) : `site` + `site_id` sur 33 tables + RLS via
>   `current_site_id()` + trigger auto-fill + `app_user.est_super_admin`.
> - PR 1b (`0044-0047`) : correctifs le même jour — `p_site` explicite pour
>   les fonctions SQL en service_role ; `audit_trigger` tolérant aux PK
>   non-`id` (bug 0043 §K) ; FKs simples restaurées pour PostgREST ; composite
>   FKs retirées à cause de l'ambiguïté d'embed (leçon `L25`).
> - PR 2 : `site.nom` en pastille (AppHeader), pied du PDF placement, TV ;
>   refus de session si site suspendu/archivé (sauf super_admin).
> - PR 3 (`0048`) : back-office `/platform` (liste/create/suspendre/archiver
>   sites), impersonation super_admin via cookie signé HMAC + header
>   PostgREST `x-impersonate-site` + bandeau rouge permanent + journal
>   `audit_impersonation`. Le layout `/platform` refuse tout non super_admin
>   (défense en profondeur en plus du middleware).
> - Reste à faire (PR 4 onboarding, PR 5 tests statiques) : détaillé dans
>   `tasks/multi-site.md` §12.
>
> Repo GitHub renommé `bigplann → polaris` le même jour, remote local mis à
> jour. URL Vercel reste `bigplann.vercel.app` (pas de domaine custom pour
> l'instant).
>
> **Session précédente (juillet–août 2026)** — grosse passe UX autour des absences, du
> temps partiel et des écrans de paramétrage :
> - Modale Absences (Personnel) refondue en édition inline avec palette motif,
>   calendrier 2 mois, commentaire, `ModaleDeplacable`, `InfoBulle` fixed ;
> - Écran « Absences spécifiques » (Planning) unifié sur les JOURS
>   (`grouperAbsences` sur tout l'effectif), filtres nom / atelier / période
>   d'intersection ;
> - **Param. RH étendu** : Motifs + Agences + **Types de contrat** + **Fenêtre
>   d'affichage** (auto-save via `/api/param-affichage`) — convention `.iconbtn` +
>   `ActifCheckbox` + icônes SVG (`SaveIcon`, `EditIcon`, `CheckIcon`, `TrashIcon`,
>   `PrintIcon`, `AbsenceIcon`, `SearchIcon`, `InfoIcon`, `GearIcon`) ;
> - **Rôles personnalisés** (migration 0042) : bouton « Nouveau rôle » dans
>   Utilisateurs, table `role_custom`, `getAllRoles()`, `/api/roles` ;
> - **Ordonnancement** : refus de fermer un quart / une ligne / réinitialiser une
>   semaine si des affectations sur poste existent (absences ignorées) ;
> - **Temps partiel** revu : « TP » = journée entière off **ou** semaine où
>   l'équipe est sur le créneau non travaillé (rotation datée → TP automatique
>   une semaine sur deux) ;
> - **Hauteur de ligne harmonisée** à 32 px sur les 6 grilles (`--grid-row-h`) ;
> - **Guide utilisateur** (`public/guide.html`) : mentions de rôles retirées, 15
>   sections toutes étoffées avec maquettes CSS fidèles.
>
> Avant : **audit de l'existant en 5 lots** (audit livré, doc archivée). Escalade
> de privilèges fermée, écritures atomiques et vérifiées, quarts sortis du code,
> 3 tables mortes supprimées. Puis fonctionnalités : bilan Planning replié,
> filtre Placement par quart, TV en fenêtre J-1→J+4, colonne Personnel « Fin
> contrat » remplacée par un suivi des absences (calendrier de plage type
> Booking, départ prévu), intérim en jaune partout.
>
> Ce qui précédait : matrice des droits stricte, numéros de rotation et habilitations
> exigées par poste, mot de passe par lien, rotation par référence datée, ossature
> `.pagecol` / `.headband` / `.gridband`, grille « personnes × colonnes » mutualisée,
> pagination `fetchAll()`.

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
`0033` `placement.numero_rotation` (place occupée sur le poste) ·
`0034` `agence_interim` (liste fermée) ·
`0035` **index sur les FK de cascade** (`placement.absence_id`, `motif_absence_id`,
`equipe_id`, `absence.motif_absence_id`, `ouverture_quart.ligne_id`) ·
`0036` audit `app_user` / `role_permission` + trigger tolérant aux tables à cle
composite + `handle_new_user` crée le profil **inactif** ·
`0037` **fonctions atomiques** `set_rotation_reference`, `creer_absence`, `maj_absence`
(RPC, `SECURITY INVOKER`) — le `delete`+`insert` applicatif ne perd plus la donnée ·
`0038` **suppression de 3 tables mortes** (`equipe_quart_semaine`, `ligne_ouverture`,
`jour_equipe`) + normalisation des 7 placements historiques sans `quart_code` ·
`0039` `personne.date_depart_prevu` / `motif_depart` (départ prévu, informatif —
ne bascule pas le statut) ·
`0040` **types de contrat paramétrables** (`type_contrat`) + fenêtre d'affichage
du planning (`parametre_affichage`, singleton `id=1`) ·
`0041` retrait du CHECK `type_contrat in ('CDI','CDD','INTERIM')` sur `personne`
et `contrat_periode` — la validation passe côté application (cf. `lessons.md` L23) ·
`0042` **rôles personnalisés** (`role_custom` : `code`, `libelle`) + retrait du
CHECK sur `app_user.role` — validation côté application (intégrés + `role_custom`) ·
`0043` **socle multi-site** : table `site` + lebignon inséré, `site_id NOT NULL`
sur 26 tables métier locales + `site_id NULL` sur 4 tables partagées
(motif_absence, type_contrat, role_custom, role_permission), unicités
réécrites en `(site_id, code)`, RLS entièrement réécrite via nouvelle
fonction `current_site_id()`, trigger `set_site_id_from_context` qui
auto-remplit `site_id` sur INSERT depuis le contexte utilisateur (fallback
lebignon en V1a), table `audit_impersonation`, `app_user.est_super_admin`
(hors matrice des rôles). Cf. `tasks/multi-site.md` ·
`0044` fonctions SQL `creer_absence` / `maj_absence` / `set_rotation_reference`
gagnent un paramètre `p_site uuid default null` (fix : `getAdminClient` en
service_role a `auth.uid()=NULL` donc `current_site_id()=NULL`) ·
`0045` `audit_trigger` reprend le pattern tolérant de la 0036
(`to_jsonb(...)->>id` avec coalesce sur `user_id` et clé composite), perdu
par erreur en 0043 §K — sinon toute écriture sur `app_user` / `role_permission`
échouait avec « column `id` not found in data type app_user » ·
`0046` **FKs simples restaurées** en plus des composites, sinon PostgREST
ne trouve pas la relation et rejette les embeds automatiques
(`SELECT "personne:personne_id(...)"`) ·
`0047` **composite FKs (id, site_id) retirées** — coexistence avec les FKs
simples provoquait un « more than one relationship » silencieux (Supabase JS
ne throw pas, retourne `data: null`, écrans vides sans erreur). L'intégrité
inter-sites est désormais portée par RLS + trigger `set_site_id_from_context`
seuls. Leçon `L25`, doc `multi-site.md §3.4` ·
`0048` `current_site_id()` lit un header `x-impersonate-site` en priorité
(propagé par le middleware depuis un cookie signé HMAC-SHA256 posé par
`/platform`), mais SEULEMENT si l'appelant est `est_super_admin` (défense
en profondeur). Permet au super_admin d'« entrer dans le site » d'une usine
pour du support, avec bandeau rouge permanent + journal.
`0049` **cycle de vie du personnel** : `personne.date_arrivee` +
`statut_calcule()` + trigger `statut_auto_personne` — le statut (A_VENIR /
ACTIF / PARTI) est une résultante des dates, plus un toggle manuel ·
`0050` **contrats = source de vérité** du cycle de vie (dates dérivées
des contrats, plus stockées directement sur `personne`) ·
`0051` **`parametre_affichage` multi-site** : PK passe de `id=1` (singleton)
à `site_id` (une ligne par site). **Pas encore jouée.**

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
Modale `TempsPartielModal`, API `/api/personnel` op `tp`. Le stockage n'a pas
changé, seule la lecture côté planning a été revue le 2026-07-24.
- `demi` : `{ mode: matin|aprem|tournant, source: quart|horaires, matin?/aprem?: {dow:{debut,fin}} }`.
  Ne produit plus de flèche « → Mat / → Apr » — cf. changement ci-dessous.
- `off` : `{ dow: ["matin","aprem"] }` demi-journées non travaillées.
- `horaires` : `{ dow: {debut,fin} }` horaires journée entière.

⚠️ **Nouveau calcul de `tpBlocked`** (`src/app/planning/page.tsx`). « TP » s'écrit
dans le planning quand l'une des deux conditions est vraie :
1. **Journée entière off** — les deux demi-journées `matin` et `aprem` dans `off`.
2. **Équipe sur le créneau non travaillé cette semaine** — si l'équipe de la
   personne tourne et se retrouve, la semaine considérée, sur le créneau qu'elle
   ne fait pas. Ex. Sylvie mi-temps après-midi (off matin) en équipe B tournante :
   la semaine où B est au matin, elle ne peut pas travailler → TP toute la semaine ;
   la semaine où B est l'après-midi, rien. Résultat : un **TP automatique une
   semaine sur deux**. Calcul via `rotByWeek[wi]` + `equipe.quart_fixe` éventuel
   + `equipeDe.get(personne_id)`.

`tpRedirect` a été **supprimé** (page.tsx + PlanningGrid) : la flèche « → Mat/Apr »
noyait l'écran de marqueurs dès qu'on regardait un quart ≠ celui de la personne.

Priorité d'affichage de l'horaire (TV) :
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

## Multi-tenant (`/platform` back-office)
Réservé aux `app_user.est_super_admin = true`. Doc complète :
`tasks/multi-site.md`. Layout dédié (fond gris, header noir, sans AppHeader),
défense en profondeur (middleware + revalidation dans le layout).
- `/platform` — liste des sites (nom, slug, statut, nb users actifs, nb
  personnes actives, date création). Bouton « Nouveau site ». Utilise
  `getAdminClient()` pour voir TOUS les sites (la RLS de `site` ne
  laisserait passer que le sien depuis une session normale).
- `/platform/nouveau` — form (nom, slug avec pattern regex + blacklist
  `platform/api/auth/admin/app/www`, email + nom du 1er admin local).
  Server action `createSite` crée la ligne `site`, l'auth user, force son
  role=admin/site_id=nouveau/is_active=true, génère le lien mdp. Rollback
  si createUser échoue.
- `/platform/[id]` — détail : 3 KPI, boutons Suspendre/Réactiver/Archiver,
  bouton « Entrer dans le site » (interdit sur archive), 10 dernières
  sessions impersonation. Server actions `changerStatut`,
  `entrerDansLeSite`, `sortirDuMode`.
- **Impersonation** : cookie signé HMAC (`polaris-impersonate`, TTL 60 min)
  contenant `{siteId, auditId, expiresAt}`. Le middleware valide la
  signature + TTL, pose le header `x-impersonate-site` sur la requête.
  `getServerClient()` propage ce header vers Supabase via
  `global.headers`, et `current_site_id()` (0048) le lit via
  `current_setting('request.headers')` — mais uniquement si l'appelant est
  `est_super_admin=true`. `getCurrentSite()` préfère aussi le header sur
  `app_user.site_id`, donc l'AppHeader / le PDF / la TV affichent bien le
  site cible. Bandeau rouge sticky en haut de toute page tant que le
  cookie est actif, avec bouton « Sortir ». Trace complète dans
  `audit_impersonation` (entrée avec IP/UA/raison, sortie updated).
- **Ne pas exposer `est_super_admin` dans `/admin/users`** : c'est un
  champ dédié, jamais lu par `getAllRoles()`, invisible aux admins locaux.
  Un admin d'une usine ne peut pas se voir accorder le super_admin.
- **Backup obligatoire** avant toute nouvelle migration multi-site : les
  0043 et suivantes touchent aux RLS et FKs de tables critiques. Cf.
  `tasks/lessons.md L25` pour le piège des composite FKs vs embeds PostgREST.

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

### Reste à faire (au 2026-07-25)
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
  l'utilisateur (c'est ainsi qu'on a trouvé L11, L20, L21, L23, L24).
- Chantier de fond toujours ouvert : **virtualisation** des grandes grilles
  (matrice ~22 000 cellules) — cf. CLAUDE.md § Performance.
- Backfill SQL des `personne_competence.date_expiration` nulles alors que la formation a
  une durée de validité (aujourd'hui compensé à l'affichage seulement).
