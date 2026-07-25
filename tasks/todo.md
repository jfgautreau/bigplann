# État & TODO — Polaris

État au 2026-07-25. Migrations appliquées jusqu'à **0042**. **189** tests Vitest.

## Sessions récentes (résumé)

**Audit de l'existant** (mi-2026) → 5 lots livrés. Escalade de privilèges fermée
(migration `0036`), écritures atomiques (`0037`), quarts sortis du code, 3 tables
mortes supprimées (`0038`), filet de tests. Résumé complet dans l'historique git
(`5a7041b`, `15c016f`, `d0a09a0`, `6f70db4`, `083c4fc`).

**Fonctionnalités enchaînées** :
- Bilan Planning replié par défaut ; filtre Placement par quart ; personnes sans
  équipe toujours visibles ; affichage TV en **fenêtre glissante J-1 → J+4**
  basée sur l'Ordonnancement (`d1e1b8c`, `fe5a2e8`).
- Personnel : colonne « Fin contrat » remplacée par bouton **Absences**
  (calendrier barré) — historique regroupé en périodes, déclaration, **départ
  prévu** (`860ffbb` + migration `0039`).
- `DateRangePicker` type Booking ; **intérim en jaune** partout ; matricule
  libre à la création (`0fc4809`).

**Session juillet–août 2026 — UX Absences, Param RH, Rôles, TP, Guide** :
- **Modale Absences (Personnel)** entièrement refondue : édition inline
  (motif via palette, calendrier 2 mois, commentaire, jours calculés),
  détection de conflit avec placements existants, `ModaleDeplacable` +
  `InfoBulle`, popovers en `position: fixed` (piège `overflow: auto`).
- **Écran /absences-specifiques** (menu Planning) unifié sur les jours
  (`grouperAbsences` sur tout l'effectif — plus les seules 3 périodes
  formellement déclarées), filtres nom / atelier / période d'intersection.
- **Param. RH étendu** — Motifs + Agences + **Types de contrat** (migration
  `0040`) + **Fenêtre d'affichage** (auto-save via `/api/param-affichage`).
  Convention `.iconbtn` + `<ActifCheckbox>` + icônes SVG partagées
  (`SaveIcon`, `EditIcon`, `CheckIcon`, `TrashIcon`, `PrintIcon`, `AbsenceIcon`,
  `SearchIcon`, `InfoIcon`, `GearIcon`). Retrait du CHECK figeant les 3 codes
  historiques `type_contrat` (`0041`).
- **Rôles personnalisés** (`0042`) : bouton « Nouveau rôle » dans Utilisateurs,
  table `role_custom`, `getAllRoles()`, `/api/roles`. Le rôle naît sans droit ;
  les garde-fous anti-escalade (calculés sur la matrice) s'appliquent
  automatiquement.
- **Ordonnancement** : refus de fermer un quart / une ligne / réinitialiser une
  semaine si des affectations sur poste existent (absences ignorées).
- **Temps partiel** revu : « TP » = journée entière off **ou** semaine où
  l'équipe est sur le créneau non travaillé (rotation datée → TP automatique
  une semaine sur deux). Ancienne flèche `tpRedirect` supprimée.
- **Placement** — intérim en jaune dans la liste des personnes à droite.
- **Personnel** — `router.refresh()` après création (le cache RSC servait
  la liste sans la nouvelle personne).
- **Placeholder** gris uniforme sur tout le site.
- **Hauteur de ligne harmonisée** à 32 px sur les 6 grilles (`--grid-row-h`).
  Référentiel : classes scope `.refpostes` / `.refhead` pour aligner la
  hauteur des CONTRÔLES (inputs / selects / boutons) à 28 px — sans ça la
  ligne paraît bancale même à rangée constante.
- **Guide utilisateur** (`public/guide.html`) : mentions de rôles retirées (16
  lignes `.who` + section « Qui peut quoi » supprimée + section 15 Dépannage
  renumérotée) ; **15 sections toutes étoffées** avec maquettes CSS fidèles
  (noms/postes fictifs) ; texte justifié pleine largeur, aligné sur les
  maquettes et les barres de titre.

## En cours / à faire

### Décisions ouvertes qui t'appartiennent

- [ ] **Placement multi-quart** — afficher les quarts cochés côte à côte. Trois
      dispositions ont été proposées ; en attente d'un arbitrage.
- [ ] **Anonymisation RGPD** — conserve aujourd'hui matricule, badge, sexe, pointure,
      contrats et motifs d'horaires spécifiques. **Pseudonymisation**, pas anonymisation.
      Deux options : corriger vraiment (effacer tout ce qui peut ré-identifier) ou
      renommer le bouton. Le bouton `/api/personnel/[id]/export` demande aussi le droit
      `personnel: write` alors que c'est une lecture sensible ; il devrait relever du
      module `rgpd`.

### Chantiers techniques identifiés

- [ ] **Virtualisation des grandes grilles** (Matrice ~22 000 cellules, Habilitations
      dans le même ordre). Plafond connu, non aggravé par le multi-sites. C'est le
      « prochain gros chantier » selon CLAUDE.md — indépendant.
- [ ] **Backfill SQL** des `personne_competence.date_expiration` nulles alors que la
      formation a une durée de validité (aujourd'hui compensé à l'affichage seulement).
- [ ] Journal : les tables sans colonne d'auteur (ex. `personne`) restent en
      « Système ». Choix « ciblé » assumé (cf. `lessons.md` L12).

### Refonte multi-sites — reportée

Le cadrage complet est dans `tasks/prompt-multisite.md` (décisions actées) et la
proposition d'architecture dans `ARCHITECTURE-MULTISITE.md`. **Explicitement
reportée** après l'audit : il fallait d'abord corriger la version actuelle, puis
la session UX a pris la suite.

## Rappels

- `npm run build` avant chaque commit ; commit + push sur `main` (déploiement Vercel auto).
- Toute nouvelle migration doit être **exécutée manuellement** dans le SQL Editor Supabase.
- Les rôles ne sont plus mentionnés dans le guide utilisateur (ils peuvent évoluer via
  `/admin/users` — bouton « + Nouveau rôle »).
