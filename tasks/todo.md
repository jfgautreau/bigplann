# TODO - Planning Usine

## Lot 0 - Cadrage
- [x] Lire le cahier des charges en entier
- [x] Reformuler la comprehension (12 points)
- [x] Trancher : nouveau depot separe, projet distinct
- [x] CHANGEMENT DE STACK : abandon Docker/Podman/Prisma -> Supabase + Vercel
- [x] Modele de donnees complet (Supabase) redige -> docs/LOT0-CADRAGE.md
- [x] Sitemap fonctionnel redige -> docs/LOT0-CADRAGE.md
- [x] Clarifications adressees (propositions C/E/F + IP couloir + Excel) dans le doc
- [ ] VALIDATION utilisateur du modele + sitemap

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

## Lot 0 - validation modele + sitemap
- [x] docs/LOT0-CADRAGE.md valide (ajustements: conducteur=poste, abaque,
      equipe/jour, conge reporte, sitemap provisoire)

## Lot 2 - Referentiel - EN COURS
- [x] Migration 0002 : atelier/ligne/poste (+abaque), equipe/equipe_chef,
      personne, audit_log + triggers audit + updated_at + RLS
- [x] Helpers : getCurrentProfile, requireAdmin ; AppHeader (nav par role)
- [x] Ecran /admin/referentiel (CRUD atelier/ligne/poste + effectif abaque + desactivation)
- [x] Ecran /admin/equipes (CRUD equipes + designation des chefs)
- [x] Ecran /personnel (liste+filtres) + /personnel/[id] (fiche) + matricule auto interim
- [x] Ecran /journal (audit, admin + resp_prod)
- [x] npm run build + TypeScript OK
- [ ] Import/export Excel : RETIRE du perimetre (demande utilisateur)
- [ ] Utilisateur : executer supabase/migrations/0002_referentiel.sql
- [ ] Verif sur Supabase reel (insert -> audit_log capture) puis demo

## Suite
- [ ] Lot 3 Matrice, Lot 4 Habilitations, Lot 5 Planning, Lot 6 Absences,
      Lot 7 Affichage couloir, Lot 8 Bilans, Lot 9 RGPD/doc/tests

## Revue
(a remplir en fin de tache)
