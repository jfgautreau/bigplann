# État & TODO — Polaris

État au 2026-07-24. Migrations appliquées jusqu'à **0039**.

## Chantier récent (session juillet 2026)

**Audit de l'existant** (`tasks/audit-existant.md`) → **cinq lots livrés**, entièrement
tracés dans l'historique git. Résumé :

| Lot | Objet | Commits |
|---|---|---|
| Étape 1 | Index de cascade + `fetchAll()` étendu (5 lectures TV/Planning) | `5a7041b` + migration `0035` |
| Étape 2 | Escalade `utilisateurs` fermée, audit sur `app_user`/`role_permission`, `is_active` vérifié à la source | `15c016f`, `d0a09a0` + migration `0036` |
| Étape 3 | Rotation et absences atomiques (RPC SQL), 17 écritures muettes rendues visibles, plafond 800 j strict | `6f70db4` + migration `0037` |
| Étape 4 | Filet de tests (permissions, gardes API, écritures vérifiées) | fusionné aux commits ci-dessus |
| Étape 5 | Quarts sortis du code (`src/lib/quarts.ts`), 3 tables mortes supprimées, `est_conducteur` retiré | `083c4fc` + migration `0038` |

**Fonctionnalités ajoutées ensuite** :

- Bilan du Planning replié par défaut ; filtre Placement par quart (montre *toutes* les
  équipes qui y travaillent, quart fixe + rotation) ; personnes sans équipe toujours
  visibles au Placement ; affichage TV en fenêtre glissante **J-1 → J+4** basée sur
  l'Ordonnancement (`d1e1b8c`, `fe5a2e8`).
- Personnel : colonne « Fin contrat » remplacée par bouton **Absences** (calendrier
  barré) — historique regroupé en périodes, déclaration, **départ prévu** (`860ffbb`
  + migration `0039`).
- Sélecteur de plage type **Booking** (deux clics), **intérim en jaune** partout,
  matricule laissé libre à la création (`0fc4809`).

**181 tests** (32 au début de la session).

## En cours / à faire

### Décisions ouvertes qui t'appartiennent

- [ ] **Placement multi-quart** — afficher les quarts cochés côte à côte. Trois
      dispositions ont été proposées ; en attente d'un arbitrage. Toucher au
      glisser-déposer sans pouvoir tester finement à l'écran serait imprudent.
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

### Refonte multi-sites — reportée

Le cadrage complet est dans `tasks/prompt-multisite.md` (décisions actées) et la
proposition d'architecture dans `ARCHITECTURE-MULTISITE.md` (63 policies RLS
inventoriées, deux arbitrages en tête : matrice des droits portée par la RLS ou
non, cookie ou JWT pour le site courant). **Explicitement reportée** après l'audit :
il fallait d'abord corriger la version actuelle.

## Rappels

- `npm run build` avant chaque commit ; commit + push sur `main` (déploiement Vercel auto).
- Toute nouvelle migration doit être **exécutée manuellement** dans le SQL Editor Supabase.
- Les faiblesses de `tasks/audit-existant.md` sont **toutes fermées** — le document reste
  utile comme trace historique et rappel des pièges du domaine.
