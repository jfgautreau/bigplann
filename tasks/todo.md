# TODO - Planning Usine

## Lot 0 - Cadrage
- [x] Lire le cahier des charges en entier
- [x] Reformuler la comprehension (12 points)
- [x] Trancher : nouveau depot separe, projet distinct
- [x] CHANGEMENT DE STACK : abandon Docker/Podman/Prisma -> Supabase + Vercel
- [ ] Modele de donnees complet (Supabase) a valider  -> APRES le socle
- [ ] Sitemap fonctionnel a valider                   -> APRES le socle
- [ ] Lever les clarifications non bloquantes (login, conducteur, transverses
      vs habilitations, granularite besoin, export Excel de reference)

## Socle auth (stack Supabase + Vercel) - EN COURS
- [x] Re-cabler le projet : retrait Docker/Prisma, ajout @supabase/ssr
- [x] Clients Supabase (navigateur + serveur + admin service_role)
- [x] proxy.ts (protection des routes, refresh session)
- [x] Migration SQL 0001 : table app_user + RLS + trigger handle_new_user
- [x] Pages login / forgot / reset / auth-callback / logout
- [x] Dashboard + gestion utilisateurs (admin) + route d'invitation
- [x] `npm run build` + TypeScript OK
- [x] Creer le projet Supabase (stcxlsmmnplxpirrnefm) + executer 0001_init.sql
- [x] Renseigner .env.local (URL + cles sb_publishable / sb_secret)
- [x] Premier admin promu (jean-francois.gautreau@evolianz.com -> role admin)
- [x] Verif runtime : /login = 200, / = 307 redirect (auth routing OK)
- [ ] Test final : se connecter avec le mot de passe admin (cote utilisateur)
- [ ] Deployer sur Vercel (GitHub -> Vercel) + variables d'env + redirect URLs

## Gestion utilisateurs - creation directe (sans email)
- [x] Route /api/users/create (admin only, createUser + mot de passe, role)
- [x] UserForm : choix mode "creer avec mot de passe" / "inviter par email"
- [x] Verifie sur Supabase reel : create -> trigger -> update role -> delete cascade

## Deploiement Vercel - EN ATTENTE
- [ ] Bloque : creation compte Vercel indisponible cote utilisateur
- [ ] (Supabase ne necessite PAS GitHub ; deploiement non requis pour dev local)

## Suite (apres validation du socle)
- [ ] Modele de donnees complet + sitemap a valider
- [ ] Modules metier : referentiel, matrice, habilitations, planning, absences,
      affichage couloir, bilans, journal d'audit

## Revue
(a remplir en fin de tache)
