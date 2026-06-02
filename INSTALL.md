# Installation — BigPlann'

## Prérequis
- Node.js 20+
- Un projet **Supabase** (gratuit suffit)

## 1. Récupérer le code et les dépendances
```sh
npm install
```

## 2. Configurer Supabase
1. Crée un projet sur https://supabase.com.
2. Dans *Project Settings* récupère : l'**URL**, la clé **publishable (anon)** et la clé
   **service_role**.
3. Copie `.env.local.example` en `.env.local` et renseigne :
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

## 3. Appliquer les migrations
Dans le **SQL Editor** de Supabase, exécute **dans l'ordre** les fichiers de
`supabase/migrations/` (0001 → 0009).

> Alternative : renseigne `SUPABASE_DB_URL` (chaîne Postgres, *Database > Connection
> string*) dans `.env.local` puis `npm run db:migrate`.

## 4. Créer le premier administrateur
1. Supabase → *Authentication > Users > Add user* (email + mot de passe, ☑ Auto Confirm).
2. SQL Editor :
   ```sql
   update public.app_user set role = 'admin' where email = 'ton.email@exemple.fr';
   ```

## 5. Lancer en local
```sh
npm run dev      # http://localhost:3000
```
Connecte-toi, puis crée la structure (Référentiel, Équipes, Personnel...).

## 6. Tests
```sh
npm test
```

## 7. Déploiement Vercel
1. Pousser le dépôt sur GitHub, l'importer dans Vercel (framework Next.js détecté).
2. Définir les 3 variables d'environnement (mêmes valeurs que `.env.local`).
3. Supabase → *Authentication > URL Configuration* : ajouter l'URL Vercel (et
   `http://localhost:3000`) aux *Redirect URLs*.
4. **Affichage couloir** : les pages `/affichage/*` sont publiques. En production,
   restreindre l'accès (allowlist IP via le proxy, Vercel Firewall, ou URL à jeton).
