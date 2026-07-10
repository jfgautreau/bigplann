# État & TODO — BigPlann'

État au 2026-07-10. L'historique détaillé des lots 0 à 9 (tous livrés) est dans
l'historique git et `docs/LOT0-CADRAGE.md` / `docs/LOT-C-CADRAGE.md`.

## Livré
Référentiel · Personnel (+ RGPD, contrats, temps partiel) · Matrice de polyvalence
(+ bilan, restrictions) · Habilitations (+ paramétrage, alertes) · Ordonnancement
(+ semaine-type, profils, rotation des équipes) · Planning (quarts, absences longues,
horaires spécifiques) · Affichage couloir (TV) · Bilans CODIR · Journal d'audit ·
Matrice de droits par module (`/admin/droits`).

## En cours / à faire
- [ ] **Backfill SQL** des `personne_competence.date_expiration` nulles alors que la
      formation a une durée de validité (aujourd'hui compensé à l'affichage seulement).
- [ ] Vérifier le comportement souhaité quand un quart n'a **aucune équipe** en rotation :
      actuellement le filtre Équipe est vidé (toutes les personnes visibles).
- [ ] Virtualisation des grandes grilles (planning « Tous », matrice « Tous », personnel)
      si la perf redevient un sujet (~300 → ~150 ms).

## Rappels
- Migrations appliquées jusqu'à **0029**. Toute nouvelle migration doit être **exécutée
  manuellement** par l'utilisateur dans le SQL Editor Supabase.
- `npm run build` avant chaque commit ; commit + push sur `main` (déploiement Vercel auto).
