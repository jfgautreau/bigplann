# BigPlann'

Application web interne de gestion des plannings d'une usine agroalimentaire :
référentiel (ateliers/lignes/postes), matrice de polyvalence, planning de placement,
habilitations à recycler, affichage couloir, bilans.

## Stack
- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase** : PostgreSQL + Auth + Row Level Security
- **Déploiement** : Vercel
- **Tests** : Vitest

## Démarrage rapide
```sh
npm install
cp .env.local.example .env.local   # renseigner les clés Supabase
# appliquer supabase/migrations/0001..0029 dans le SQL Editor Supabase
npm run dev                         # http://localhost:3000
```
Détails : voir **INSTALL.md**.

## Modules
- **Référentiel** : ateliers / lignes / postes (+ abaque, code court, conducteur), équipes & chefs.
- **Personnel** : fiche, recherche par colonne, RGPD (export / anonymiser / supprimer).
- **Matrice de polyvalence** : camemberts (niveau actuel/cible), objectifs par poste + bilan.
- **Habilitations à recycler** : échéances, alertes couleur (vert/orange/rouge), cloche d'alerte.
- **Ordonnancement** : ouverture des lignes par équipe (1 mois), tout ouvert sauf dimanche.
- **Planning** : 3 semaines, placement (poste / absence / NT), indicateurs (besoin/présent/
  delta/alertes), sur-effectif, remplissage semaine + copie S-1.
- **Affichage couloir** : écran TV par atelier (J et J+1, refresh 60 s, PDF).
- **Bilans** : effectifs, absences par motif, polyvalence.
- **Journal d'audit** + notifications (cloche habilitations).

## Documentation
- **CLAUDE.md** — brief pour l'agent : règles de travail, permissions, pièges métier.
- **INSTALL.md** — installation, Supabase, premier admin, déploiement.
- **OPERATIONS.md** — mises à jour, migrations, sauvegardes, utilisateurs, RGPD.
- **ARCHITECTURE.md** — modèle de données, RLS, rôles, sitemap.
- **tasks/handoff.md** — détail métier & patterns UI · **tasks/lessons.md** — pièges connus.

## Commandes
```sh
npm run dev     # développement
npm run build   # build production
npm test        # tests unitaires (règles métier)
```
