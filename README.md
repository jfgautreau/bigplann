# Planning Usine

Application web interne de gestion des plannings d'une usine agroalimentaire
(matrice de polyvalence, placement journalier, habilitations, affichage couloir).

> **Etat actuel : SOCLE (auth) — stack Supabase + Vercel.**
> Ce depot ne contient pour l'instant que le socle d'authentification permettant
> de valider la stack. Les modules metier seront ajoutes ensuite.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase** : PostgreSQL + Auth + Row Level Security (RLS), via `@supabase/ssr`
- **Deploiement : Vercel** (push GitHub -> deploiement automatique)

## Configuration

1. **Creer le projet Supabase** (nouveau compte) puis recuperer dans
   *Project Settings* : l'URL, la cle *publishable/anon* et la cle *service_role*.
2. Copier `.env.local.example` en `.env.local` et renseigner les 3 variables :
   ```sh
   cp .env.local.example .env.local
   ```
3. **Appliquer le schema** : ouvrir le *SQL Editor* de Supabase et executer
   `supabase/migrations/0001_init.sql` (cree la table `app_user`, la RLS et le
   trigger de creation de profil).
4. **Creer le premier admin** :
   - Dashboard Supabase > *Authentication* > *Add user* (ou via un signup).
   - Puis dans le SQL Editor :
     ```sql
     update public.app_user set role = 'admin'
     where email = 'ton.email@exemple.fr';
     ```

## Developpement local

```sh
npm install
npm run dev      # http://localhost:3000
```

## Deploiement Vercel

1. Pousser le depot sur GitHub.
2. Importer le repo dans Vercel (framework detecte : Next.js).
3. Definir les 3 variables d'environnement (memes valeurs que `.env.local`)
   dans *Project Settings > Environment Variables*.
4. Dans Supabase > *Authentication > URL Configuration*, ajouter l'URL Vercel
   (et `http://localhost:3000`) aux *Redirect URLs* pour les liens d'invitation.

## Criteres de validation du socle

1. Le build passe (`npm run build`).
2. Connexion possible avec le compte admin sur `/login`.
3. Depuis `/admin/users`, l'admin invite un utilisateur (email recu).
4. L'invite definit son mot de passe via le lien et accede a l'appli avec son role.
5. Un non-admin n'a pas acces a `/admin/users` (redirige vers `/`).

## Structure

```
supabase/migrations/   schema SQL (app_user, RLS, trigger)
src/lib/supabase.ts          client navigateur (anon, RLS)
src/lib/supabase-server.ts   clients serveur (session) + admin (service_role)
src/lib/roles.ts             roles applicatifs + libelles
src/lib/password.ts          politique de complexite du mot de passe
src/proxy.ts                 protection des routes (ex-middleware)
src/app/login | forgot | reset    flux d'authentification
src/app/auth/callback        echange du code OTP (invitation / recuperation)
src/app/admin/users          gestion / invitation des utilisateurs (admin)
src/app/api/users/invite     route serveur d'invitation (service_role)
```
