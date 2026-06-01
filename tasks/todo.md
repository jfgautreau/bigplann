# TODO - Planning Usine

## Lot 0 - Cadrage
- [x] Lire le cahier des charges en entier
- [x] Reformuler la comprehension (12 points)
- [x] Trancher : nouveau depot separe, stack neuve, test local d'abord
- [x] Choisir Podman (gratuit) au lieu de Docker Desktop
- [ ] Modele de donnees complet (Postgres) a valider  -> APRES le test simplifie
- [ ] Sitemap fonctionnel a valider                   -> APRES le test simplifie
- [ ] Lever les clarifications non bloquantes (login, conducteur, transverses
      vs habilitations, granularite besoin, export Excel de reference)

## Test simplifie (stack + amorce Lot 1) - EN COURS
- [x] Scaffolder le projet (Next 16 + Prisma + Postgres + Podman)
- [x] Schema AppUser + roles
- [x] Auth : login bcrypt, session cookie signe, politique mdp, lockout 5 echecs
- [x] Page login, dashboard, gestion utilisateurs admin, logout
- [x] Dockerfile + docker-compose.yml (db + web)
- [x] `npm install` + `prisma generate` + `npm run build` OK en local
- [x] Typecheck `tsc --noEmit` OK (exit 0)
- [x] Schema applique via `prisma db push` (pas de migration versionnee pour le test)
- [ ] `podman compose up -d` valide (apres install Podman par l'utilisateur)
- [ ] Demonstration : admin se connecte + cree un utilisateur

## Suite (vrai Lot 1, apres validation du test)
- [ ] Reverse proxy Caddy + HTTPS local + filtrage IP affichage couloir
- [ ] Sortie standalone Next + Dockerfile multi-stage optimise
- [ ] Scripts shell (start/stop/update/backup/restore) + rotation pg_dump
- [ ] Environnements production + test

## Revue
(a remplir en fin de tache)
