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
poster explicitement l'état en JSON vers une route API (modèle : `/api/ordonnancement/semaine-type`
+ bouton « Enregistrer » côté client). NB : la rotation des équipes, qui illustrait ce piège,
n'utilise plus ce pattern depuis le passage aux références datées (selects non contrôlés rendus
côté serveur dans un `<form action={serverAction}>` — la sérialisation native fonctionne alors).

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

## L9 — `scrollbar-gutter: stable` ampute la course sur un axe `overflow: hidden`
Le panneau d'en-têtes de la matrice suit le `scrollLeft` de la liste. Il s'arrêtait
**15 px trop tôt** en fin de course, décalant les noms de poste d'une demi-colonne.
Chrome retranche la gouttière réservée de la zone défilable quand l'axe est en
`overflow: hidden` : `scrollWidth - clientWidth` annonce 331 px, mais `scrollLeft`
plafonne à 316.
**Règle** : sur un panneau dont un axe est masqué et l'autre asservi, utiliser
`overflow-y: scroll` (une vraie piste vide réserve la même largeur) plutôt que
`overflow-y: auto` + `scrollbar-gutter: stable`.

## L10 — La hauteur de ligne d'un tableau dépend de la ligne de base
À contenu identique (une pastille de 28 px), la matrice affichait des lignes de 44 px et
les habilitations de 41 px : la case de la matrice est un `<button>` (`inline-block`, donc
aligné sur la ligne de base, ce qui ajoute la place de la descendante), celle des
habilitations un `<span>` inerte.
**Règle** : pour deux grilles jumelles, fixer explicitement `height` sur la cellule et
`vertical-align: middle` sur son contenu, plutôt que de laisser la typographie décider.
Aujourd'hui : `--row-h: 32px`, `--cell: 28px` dans `persongrid.module.css`.

## L11 — Un `<button>` à fond clair rend son texte invisible
Sur l'écran Placement, les flèches de navigation du jour et les libellés des chips
d'absence étaient **invisibles** : le style global `button` (globals.css) impose
`color: var(--primary-text)` (blanc), et ces boutons ne redéfinissaient que `background: #fff`
→ blanc sur blanc.
**Règle** : tout bouton qui change son `background` pour une teinte claire doit **aussi**
poser un `color` explicite. Symptôme typique : « le bouton est là mais vide ».

## L12 — L'audit n'attribue rien quand on écrit via le service role
Le journal affichait « Système » pour les affectations du planning et la matrice, alors que
les motifs (server action) étaient bien à l'utilisateur. Cause : `audit_trigger` lit
`auth.uid()`, **null** avec `getAdminClient()` (service role, sans session JWT) — or les
écritures « complètes » passent justement par ce client (cf. L5).
**Règle** : ne pas compter sur `auth.uid()` dans un trigger pour du code qui bypasse la RLS.
Repli retenu (migration 0031) : le trigger prend `created_by` / `auteur_app_user_id` de la
ligne. Une table sans colonne d'auteur restera non attribuée.

## L13 — Next.js 16 : `revalidateTag` prend 2 arguments, `updateTag` est fait pour les server actions
`revalidateTag(tag)` ne compile plus (`Expected 2 arguments`) : la signature est
`revalidateTag(tag, profile)`. Depuis une server action, la bonne fonction est
`updateTag(tag)` (sémantique *read-your-own-writes*).
**Règle** : pour qu'un edit se reflète immédiatement dans un cache `unstable_cache`, tagger
le cache (`tags: [...]`) et appeler `updateTag(tag)` dans l'action — `revalidatePath` seul
n'invalide pas un `unstable_cache`.
**Corollaire** : après suppression d'une route API, `.next/dev/types/validator.ts` la
référence encore et fait échouer le build → `rm -rf .next` puis rebuild.

## L14 — JSX/SWC : l'espace après `</strong>` disparaît si le texte contient `&apos;`
Symptôme : « BOY Melvin**n'est** pas habilitée » — l'espace entre le gras et le texte
suivant a disparu, alors qu'il est bien présent dans le source.
**Cause** : SWC (Next.js) supprime les espaces de tête de chaque ligne d'un nœud texte
JSX multi-ligne, y compris la première, **quand ce nœud contient une entité HTML**
(`&apos;`, `&ge;`…). Sans entité, l'espace survit — d'où le caractère intermittent.
Deux formes touchées :
- `<strong>x</strong>\n   texte` (fermeture en fin de ligne) → toujours cassé ;
- `<strong>x</strong> texte\n   suite` → cassé **seulement** si le nœud a une entité.
⚠️ **Ne pas vérifier avec esbuild** : il garde l'espace dans les deux cas et innocente à
tort le code. La seule preuve est le build : `grep -rho '.\{0,10\}mon texte' .next/server`
— on doit y voir `," ","mon texte` et non `,"mon texte`.
**Règle** : dès qu'un texte suit une balise inline fermante, poser un `{" "}` explicite et
faire commencer le texte sans espace. C'est déjà le pattern du projet (cf. `/planning`).
Piège dormant : un texte correct aujourd'hui casse le jour où l'on y ajoute une apostrophe.
