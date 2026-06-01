# Planning Usine

Application web interne de gestion des plannings d'une usine agroalimentaire
(matrice de polyvalence, placement journalier, habilitations, affichage couloir).

> **Etat actuel : TEST SIMPLIFIE (Lot 0 -> amorce Lot 1).**
> Ce depot ne contient pour l'instant que le socle minimal permettant de
> valider la stack (PostgreSQL + Next.js via Docker/Podman) et l'authentification.
> Les modules metier seront ajoutes apres validation de ce test.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **PostgreSQL 16** + **Prisma** (ORM)
- **Auth maison** : email + mot de passe (bcrypt), session cookie signe (JWT/jose),
  politique de complexite, verrouillage apres 5 echecs
- **Docker / Podman Compose** (un seul `compose up -d` lance toute la stack)

## Demarrage rapide (avec Podman ou Docker)

Prerequis : **Podman Desktop** (ou Docker Desktop) installe et demarre.

```sh
# 1. Copier le modele d'environnement et l'adapter
cp .env.example .env        # puis editer .env (mots de passe, SESSION_SECRET)

# 2. Lancer toute la stack (db + web). Build au premier lancement.
podman compose up -d         # ou : docker compose up -d

# 3. Suivre le demarrage (migrations + seed admin)
podman compose logs -f web

# 4. Ouvrir l'application
#    http://localhost:3000
```

Au premier demarrage, l'administrateur initial est cree automatiquement
a partir des variables `ADMIN_EMAIL` / `ADMIN_PASSWORD` du fichier `.env`.

Identifiants par defaut (`.env.example`) :
- email : `admin@usine.local`
- mot de passe : `Admin1234!`

### Criteres de validation du test

1. `podman compose up -d` demarre sans erreur (services `db` + `web`).
2. Connexion possible avec le compte admin sur `http://localhost:3000`.
3. L'admin peut creer un autre utilisateur depuis `/admin/users`.
4. `podman compose down` puis `up -d` : les donnees persistent (volume `pgdata`).

## Developpement local (sans conteneuriser le web)

```sh
npm install
# Demarrer uniquement la base via compose :
podman compose up -d db
# Appliquer le schema + seed (utilise DATABASE_URL=localhost du .env) :
npm run db:push
npm run db:seed
npm run dev      # http://localhost:3000
```

> Note : sur certaines machines Windows, le moteur natif Prisma peut etre mal
> telecharge (« not a valid Win32 application »). Le chemin recommande pour le
> test reste donc **la stack conteneurisee** (`podman compose up -d`), ou le
> moteur Linux est utilise. La migration versionnee remplacera `db push` au Lot 1.

## Arret

```sh
podman compose down            # arrete et supprime les conteneurs
podman compose down -v         # + supprime le volume de donnees (remise a zero)
```

## Structure

```
prisma/schema.prisma   modele de donnees (AppUser pour l'instant)
prisma/seed.mjs        creation de l'admin initial
src/lib/               prisma, sessions (jose), auth, politique mot de passe
src/middleware.ts      protection des routes
src/app/login          page de connexion
src/app/admin/users    gestion des utilisateurs (admin)
docker-compose.yml     stack db + web
```
