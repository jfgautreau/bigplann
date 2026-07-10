# Leçons

Pièges déjà payés une fois. Les relire évite de les repayer.

## L1 — Valider la stack/hébergement AVANT de coder
Le cahier des charges imposait une stack (Docker/Postgres/Prisma, serveur local),
mais l'utilisateur a finalement choisi Supabase + Vercel. Beaucoup de code a été
écrit puis jeté.
**Règle** : en cadrage, confirmer explicitement stack ET hébergement avant tout
scaffolding. Une exigence « imposée » dans un cahier peut être renégociée par le client.

## L2 — PowerShell 5.1 : pas de guillemets `"` dans un message git inline
Un `git commit -m @'...'@` contenant des guillemets doubles a cassé le passage
d'arguments (mots interprétés comme pathspecs).
**Règle** : pour les messages multi-lignes, here-string `@'…'@` avec le `'@` final en
colonne 0, ou écrire le message dans un fichier et faire `git commit -F fichier`.

## L3 — Un `<select>` contrôlé (client) ne se soumet pas dans un `<form action={serverAction}>`
L'enregistrement de la rotation des équipes échouait silencieusement : la grille était un
composant client avec des `<select>` contrôlés à l'intérieur d'un `<form>` server-action
parent ; les valeurs n'étaient pas sérialisées de façon fiable.
**Règle** : pour une grille éditable, ne pas compter sur la sérialisation du formulaire —
poster explicitement l'état en JSON vers une route API (modèle : `/api/ordonnancement/rotation`
+ bouton « Enregistrer » côté client).

## L4 — `<input type="color">` fait planter le navigateur
Le sélecteur de couleur natif ouvre une boîte de dialogue OS qui gelait le navigateur.
**Règle** : proposer une palette de pastilles cliquables (`TeamColorPicker`), jamais le
picker natif.

## L5 — Droit « module » ≠ périmètre : le chef d'équipe ne doit jamais recevoir le client admin
En donnant `getAdminClient()` dès que le module était en `write`, le chef d'équipe a pu
éditer hors de son équipe (régression de périmètre).
**Règle** : `canWriteModule()` renvoie `false` pour `chef_equipe`. Écriture « complète »
→ `getAdminClient()` ; sinon `getServerClient()` et on laisse la RLS (`can_edit_personne`)
faire le tri.

## L6 — `personne_competence.date_expiration` est stockée, pas calculée
Une formation passée à 24 mois de validité continuait de s'afficher « à vie » : l'échéance
avait été figée (ou laissée nulle) au moment de la saisie et changer
`competence.duree_validite_mois` ne recalcule rien.
**Règle** : à l'affichage, retomber sur `addMonthsIso(date_obtention, duree_validite_mois)`
quand `date_expiration` est nulle (`src/lib/habilitations.ts`). Se méfier plus largement des
colonnes dérivées figées à l'écriture.

## L7 — Le build échoue sur le code mort
`next build` fait échouer les imports et variables inutilisés. En supprimant une section
d'écran, penser à retirer imports, types, requêtes et props devenus orphelins.

## L8 — PostgREST tronque silencieusement à 1000 lignes
Une modification de la matrice partait bien en base mais ne se réaffichait jamais : la
lecture de `matrice` (1276 lignes) renvoyait `data` de longueur 1000 et `error` à `null`.
Le réglage `db-max-rows` de Supabase plafonne **chaque** réponse, sans le signaler. Toutes
les lectures non paginées de `matrice` et `personne_competence` étaient donc fausses —
matrice, planning, habilitations et les cinq bilans.
Le piège est latent ailleurs : `placement` ne compte que 380 lignes tant que le planning
est vide, mais un mois rempli en produit ~7 000 (231 personnes x 31 jours). `ouverture_quart`
atteint déjà 764 lignes pour un seul mois.
**Règle** : dès qu'une table *peut* dépasser 1000 lignes, passer par `fetchAll()`
(`src/lib/fetch-all.ts`), qui pagine par tranches de 1000. La fabrique de requête doit
poser un `.order(...)` déterministe, sinon deux tranches peuvent se recouvrir. Attention
à la clé de tri : `matrice`, `personne_competence` et `placement` ont un `id`, mais
`ouverture_quart` et `jour_quart` n'en ont pas — il faut y trier sur la clé composite.
