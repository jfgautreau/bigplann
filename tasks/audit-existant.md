# Audit de l'existant — Polaris mono-site

> Relevé le 22/07/2026 sur `main` (b6d49f4 + doc multi-sites), à partir du code
> réel : 34 migrations, 62 fichiers accédant à Postgres, 26 routes API,
> 100 appels d'écriture.
>
> Objet : corriger la version actuelle, et préparer le terrain de la refonte
> multi-sites **sans l'engager**. Chaque constat porte une gravité, une preuve
> (fichier:ligne), un correctif, et l'indication de son impact sur la migration
> à venir.

---

## Verdict en trois lignes

La base de code est **saine sur la forme** : aucun `any`, aucun `console.log`,
aucun `TODO` laissé traîner, des commentaires qui expliquent le *pourquoi*, et
les 26 routes API portent toutes une garde d'autorisation. Le piège `fetchAll()`
(leçon L8) est correctement traité **partout où il compte**.

La fragilité est ailleurs, et elle est constante : **les écritures ne sont ni
atomiques, ni vérifiées**. 16 écritures sur 100 ignorent leur erreur, trois
séquences « supprimer puis réinsérer » peuvent perdre des données sans le dire,
et le modèle d'autorisation laisse une porte d'escalade ouverte.

Aucun de ces défauts n'est bloquant aujourd'hui. **Tous se multiplient par le
nombre de sites** le jour de la refonte.

---

## A. Sécurité

### A1 — Escalade de privilèges via le droit `utilisateurs` — **Élevé**

**Preuve** : [route.ts:23](src/app/api/users/role/route.ts:23) ·
[route.ts:29](src/app/api/users/create/route.ts:29) ·
[route.ts:19](src/app/api/users/reset-password/route.ts:19)

Un compte non-admin porteur de `utilisateurs: write` peut :
1. créer un compte (`/api/users/create`) ;
2. le promouvoir **admin** (`/api/users/role` — `isRole()` accepte `"admin"`) ;
3. récupérer son **lien de mot de passe** (la route le renvoie en clair) ;
4. s'y connecter.

Trois requêtes, et il est admin. Les deux garde-fous existants ne couvrent que
l'auto-verrouillage (« on ne change pas son propre rôle », « on ne se désactive
pas soi-même ») — pas l'escalade par compte interposé.

Corollaire : le même compte peut **rétrograder l'admin** en `codir`. C'est
d'autant plus incohérent que `/api/droits` protège explicitement les droits de
l'admin ([route.ts:21](src/app/api/droits/route.ts:21)).

> Exploitable seulement si l'admin a accordé `utilisateurs: write` à un autre
> rôle — mais l'écran des droits invite précisément à le faire, et rien n'avertit
> que ce droit-là vaut « admin ».

**Correctif** : dans `/api/users/role`, refuser d'attribuer **ou de retirer** le
rôle `admin` à qui n'est pas admin lui-même ; ne jamais renvoyer le lien de mot
de passe d'un compte de rôle supérieur à l'appelant. Ou, plus simple et plus
honnête : documenter que `utilisateurs: write` **est** le droit d'administration,
et l'afficher comme tel dans la matrice.

### A2 — Aucune trace d'audit sur les droits ni sur les rôles — **Élevé**

**Preuve** : les triggers `audit_*` couvrent 13 tables ([0002](supabase/migrations/0002_referentiel.sql:143),
[0004](supabase/migrations/0004_matrice.sql:102), [0005](supabase/migrations/0005_planning.sql:63),
[0007](supabase/migrations/0007_motifs.sql:46), [0017](supabase/migrations/0017_contrat_periode.sql:55),
[0023](supabase/migrations/0023_absence.sql:45)). **19 tables sur 32 n'ont aucun
trigger**, dont `app_user` et `role_permission`.

Autrement dit : **celui qui s'octroie un droit, change un rôle ou désactive un
compte ne laisse aucune trace**, dans une application qui possède un journal
d'audit et un rôle CODIR dont c'est la raison d'être. C'est le trou qui rend A1
indétectable *a posteriori*.

Sont également non tracés : `quart`, `jour_quart`, `ouverture_quart`,
`horaire_poste`, `horaire_exception`, `rotation_reference`, `poste_quart`,
`poste_competence_requise`, `semaine_type_*`, `agence_interim`.

**Correctif** : migration ajoutant `audit_trigger` sur `app_user`,
`role_permission` en priorité, puis sur les tables de paramétrage. Attention :
`audit_trigger` lit `(new).id` — les tables à clé composite n'ont pas de colonne
`id` et feraient échouer le trigger. Il faut d'abord généraliser le trigger
(repli sur `to_jsonb(new)` pour l'identifiant), sinon l'ajout casse les écritures.

### A3 — Le rôle par défaut d'un nouveau compte est `codir` — **Moyen** *(à confirmer côté Supabase)*

**Preuve** : [0003_roles.sql:29](supabase/migrations/0003_roles.sql:29) —
`handle_new_user()` insère `role = 'codir'`, et `defaultsFor("codir")`
([permissions.ts:55](src/lib/permissions.ts:55)) accorde la **lecture** sur
personnel, matrice, habilitations, planning, ordonnancement, bilans et journal.

Le trigger se déclenche sur **toute** insertion dans `auth.users`. Si
l'inscription publique est restée activée dans le projet Supabase, n'importe qui
crée un compte et obtient l'accès en lecture à tout le personnel de l'usine.

L'application ne propose aucun écran d'inscription ([login/page.tsx](src/app/login/page.tsx)
n'appelle que `signInWithPassword`), mais **l'endpoint Supabase, lui, ne dépend
pas de l'application**.

**Je n'ai pas pu le vérifier** : le MCP Supabase pointe sur un autre compte.
À contrôler dans le dashboard (*Authentication → Sign In / Providers → Allow new
users to sign up*). Si activé : le désactiver, et passer le rôle par défaut à un
rôle sans aucun droit.

### A4 — Route morte exposée : `/api/ordonnancement/toggle` — **Moyen**

**Preuve** : [toggle/route.ts](src/app/api/ordonnancement/toggle/route.ts) —
**aucun appelant dans tout le code**. Elle écrit dans `ligne_ouverture` et
`jour_equipe`, deux tables que **plus aucune lecture n'utilise** (l'ouverture
passe par `ouverture_quart` / `jour_quart` depuis la migration 0013).

Un endpoint POST authentifié qui écrit dans des tables mortes : rien de grave, et
rien qui justifie de le garder.

**Correctif** : supprimer la route, puis les deux tables (cf. E2).

### A5 — Le proxy ne protège aucune route API — **Information, à ne pas perdre de vue**

**Preuve** : [proxy.ts:64](src/proxy.ts:64) — le matcher exclut `api/`.

C'est un choix cohérent (chaque route se garde elle-même, et les 26 le font
effectivement). Mais **une route nouvelle est publique par défaut**, et aucun
test ne le détecterait. C'est le genre d'oubli qui se paie une fois.

**Correctif** : un test qui énumère `src/app/api/**/route.ts` et vérifie que
chaque fichier référence bien une garde (`getCurrentProfile`, `moduleWriteGuard`,
`canWriteModule`…). Dix lignes, et le trou ne peut plus se rouvrir.

### A6 — `role === "admin"` en dur : 11 occurrences — **Faible aujourd'hui**

**Preuve** : `/api/habilitations-param:20`, `/api/horaires:14`,
`/api/personnel:74`, `/api/personnel/merge:51`, `/api/personnel/[id]/export:15`,
`/api/referentiel:52`, `/api/users/{create:29,role:23,active:20,reset-password:19}`,
`permissions.ts:{138,158}`.

`CLAUDE.md` affirme « plus aucun `role === "admin"` en dur ». **C'est faux.**
Inoffensif aujourd'hui (redondant avec `defaultsFor("admin")` qui accorde tout),
mais le brief et le code divergent — et c'est exactement le genre d'écart qui
fait qu'on cesse de croire le brief.

---

## B. Intégrité des données

### B1 — La rotation d'une semaine peut être perdue définitivement — **Élevé**

**Preuve** : [equipes/actions.ts:107-108](src/app/admin/equipes/actions.ts:107)

```ts
await supabase.from("rotation_reference").delete().eq("semaine", semaine);
if (rows.length) await supabase.from("rotation_reference").insert(rows);
```

Deux requêtes, aucune transaction, **aucune des deux erreurs n'est lue**. Si
l'insert échoue, la référence de rotation de cette semaine est effacée et
personne n'en est informé — l'écran redirige comme si tout allait bien.

Or c'est une donnée **non recalculable** : `CLAUDE.md` précise que la rotation
des semaines suivantes est déduite de la référence datée la plus récente. Perdre
une référence décale silencieusement toutes les semaines postérieures.

**Correctif** : une fonction SQL `set_rotation_reference(semaine, rows jsonb)`
qui fait le `delete`+`insert` dans **une** transaction, appelée en RPC ; et lire
l'erreur pour la remonter à l'écran.

### B2 — Modifier une absence peut la laisser sans placements — **Élevé**

**Preuve** : [absence/route.ts:117-130](src/app/api/absence/route.ts:117)

`op = "update"` supprime les placements de l'absence **puis** les recrée. Si
l'upsert échoue (conflit, réseau), les placements sont perdus et l'absence
subsiste avec ses nouvelles dates : le planning n'affiche plus l'absence, mais la
liste des absences si. Aucun rollback — alors que `op = "save"` juste au-dessus,
lui, en a un ([absence/route.ts:78](src/app/api/absence/route.ts:78)). L'auteur a
vu le problème à un endroit et l'a manqué à l'autre.

**Correctif** : même remède que B1 (RPC transactionnelle), ou à défaut recopier
le rollback de `save`.

### B3 — La copie d'une journée perd les numéros de rotation — **Moyen**

**Preuve** : [placement/copy/route.ts:33](src/app/api/placement/copy/route.ts:33)
sélectionne `personne_id, poste_id, equipe_id, quart_code` — **pas
`numero_rotation`** — et l'insert ne le repose pas.

Conséquence concrète sur l'écran Placement : après « copier le jour précédent »,
les personnes ne sont plus dans leur case numérotée mais dans la zone « sans
numéro » de la tuile. Le plan imprimé change de forme sans raison visible.

Régression introduite par la migration 0033 (`placement.numero_rotation`, juillet)
sur une route écrite avant.

**Correctif** : ajouter la colonne à la sélection et à l'insert. Deux mots.

### B4 — 16 écritures sur 100 ignorent leur erreur — **Moyen, systémique**

**Preuve** : `admin/motifs/actions.ts:{19,58,66}`, `admin/competences/actions.ts:{41,67}`,
`admin/equipes/actions.ts:{69,84,107,119}`, `personnel/actions.ts:{37,67,102}`,
`api/personnel/route.ts:{59,115}`, `api/absence/route.ts:{78,117}`.

Le motif est toujours le même : `await supabase.from(…).insert(…)` sans
`const { error }`. Symptôme utilisateur : **« je clique sur Enregistrer, l'écran
se recharge, et rien n'a changé »** — sans le moindre message.

Cas les plus probables en exploitation : créer un motif d'absence dont le
`code_court` existe déjà (contrainte `unique`), créer une agence d'intérim déjà
présente à la casse près (`unique (lower(nom))`, migration 0034), renommer une
personne avec un matricule déjà pris.

**Correctif** : lire `error` et le remonter. Les server actions n'ont pas de
canal de retour aujourd'hui (elles font `redirect()`) — le plus simple est
`redirect(PATH + "?err=…")` et un bandeau dans la page, comme le fait déjà
`LienMotDePasse` pour ses erreurs.

### B5 — La création d'une personne n'est pas atomique — **Moyen**

**Preuve** : [api/personnel/route.ts:95-138](src/app/api/personnel/route.ts:95)

Une création enchaîne jusqu'à **cinq** requêtes : `insert personne`, `insert
contrat_periode`, puis trois `update personne` successifs (atelier, sexe, badge +
livret). Un échec au milieu laisse une personne incomplète.

Aggravant : ces étapes sont entourées de `try { … } catch { /* migration non
appliquée */ }`. Ces gardes de transition datent des migrations 0017/0020/0022/0024,
**toutes appliquées depuis des mois**. Elles n'ont plus d'objet et **avalent
désormais de vraies erreurs** (violation de contrainte, panne réseau).

**Correctif** : un seul `insert` avec toutes les colonnes, `contrat_periode` en
second avec son erreur lue, et suppression des `catch` de transition.

### B6 — Deux chemins d'écriture divergents sur `personne` — **Moyen**

**Preuve** : [personnel/actions.ts:33](src/app/personnel/actions.ts:33) (server
action) et [api/personnel/route.ts:85](src/app/api/personnel/route.ts:85) (route
API) créent tous deux une personne, avec des règles **différentes** :

| | server action | route API |
|---|---|---|
| Normalisation `NOM` / `Prénom` | **non** | oui (`normaliseNom`) |
| Création de `contrat_periode` | **non** | oui |
| Champs atelier / sexe / badge | non | oui |

Selon l'écran utilisé, la même opération métier ne produit pas la même donnée.
La casse des noms finit par diverger dans la liste, et des personnes n'ont pas de
période de contrat initiale.

**Correctif** : un seul chemin. La route API est la plus complète — l'action
devrait l'appeler ou disparaître.

### B7 — Une absence de plus de 800 jours est tronquée en silence — **Faible**

**Preuve** : [absence/route.ts:19](src/app/api/absence/route.ts:19) — `guard < 800`.

Un congé parental de trois ans matérialise 800 jours puis s'arrête, sans erreur.
Le garde-fou est sain (il évite une boucle folle sur des dates aberrantes), mais
il doit **refuser** plutôt que tronquer.

---

## C. Performance

> **Mesures relevées le 23/07/2026** (script de lecture seule, base de production),
> qui corrigent deux estimations de cette section :
> `placement` **821** lignes · `absence` **0** · `ouverture_quart` **1385** ·
> `matrice` **2327** · `personne_competence` **1421** · `horaire_poste` **725** ·
> `personne` **386** · `poste` **90** · `ligne` **31** · 5 ateliers, 4 quarts.
>
> Conséquences : **C1 est préventif et non curatif** (la table `absence` est vide,
> la cascade ne balaye rien aujourd'hui) ; **C2 était incomplet** — l'écran TV,
> que je n'avais pas listé, est le plus exposé (cf. C2 révisé).

### C1 — `placement.absence_id` : cascade sans index — **Préventif**

**Preuve** : [0023_absence.sql:25](supabase/migrations/0023_absence.sql:25) crée
`placement.absence_id … on delete cascade`. **Aucun index** ne le couvre (les
seuls index de `placement` sont `jour`, `(poste_id, jour)`, `personne_id`,
`(jour, quart_code)`).

Chaque suppression d'absence, et chaque modification (qui fait
`delete().eq("absence_id", …)`), déclenche un **balayage complet de `placement`**.
La table grossit d'environ 7 000 lignes par mois : le coût augmente
indéfiniment, sans que rien ne le signale.

Même remarque, moins urgente, pour `placement.motif_absence_id`,
`placement.equipe_id` et `absence.motif_absence_id` (FK `on delete set null` non
indexées : c'est la suppression d'un motif qui balaye).

**Correctif** : `create index concurrently placement_absence_idx on placement
(absence_id);` — quatre index à ajouter, effet immédiat, aucun risque.

### C2 (révisé après mesure) — 5 lectures exposées à la troncature — **Moyen**

Le plafond est **réel et déjà atteint** : lire `ouverture_quart` sans protection
renvoie exactement **1000 lignes sur 1385**, `error` à `null`. Vérifié en
production.

| Lecture | Volume mesuré | Seuil de rupture | Verdict |
|---|---|---|---|
| **TV — `horaire_poste`** (postes de l'atelier × 4 quarts × 7 j) | **520** (Condi, 37 postes) | ~71 postes dans un atelier | **le plus exposé** — déjà à mi-chemin |
| Planning — `ouverture_quart` (3 sem. × 1 quart) | 199 | ~48 lignes de production | réel |
| TV — `ouverture_quart` (7 j × 4 quarts, **non filtré par atelier**) | 175 | ~35 lignes | réel |
| TV — absences (7 j, **tout le site**, filtré ensuite en mémoire) | 89 | ~1000 absences/sem. | faible |
| TV — `placement` (postes × 7 j) | 75 | ~1000 placements/sem. | faible |
| Placement — `ouverture_quart` (**1 jour × 1 quart**) | ~20 | ~1000 lignes de production | **aucun** — non modifié |

L'écran TV concentre 4 des 5 lectures à risque : il balaie une semaine entière,
tous quarts confondus, et il n'est **surveillé par personne**. Une troncature y
afficherait des horaires faux ou des postes manquants en silence.

**Correctif appliqué** (étape 1, 23/07/2026) : `fetchAll()` + `.order()`
déterministe sur les 5 lectures réellement exposées. `placement/page.tsx` est
volontairement **laissé tel quel** — borné à un jour et un quart — avec un
commentaire qui évite de refaire l'analyse. Résultats vérifiés identiques
avant/après sur les 6 requêtes.

### C3 — Le plafond de `/matrice` reste entier — **Connu, non traité**

~22 000 cellules, 1,8 Mo de HTML. Déjà documenté dans `CLAUDE.md`. Rien de
nouveau ici, sinon que **la refonte multi-sites ne l'aggrave pas** (le nombre de
cellules est par site) et ne le résout pas. La virtualisation reste le chantier
suivant, indépendant.

---

## D. RGPD

### D1 — L'anonymisation n'anonymise qu'à moitié — **Moyen**

**Preuve** : [personnel/actions.ts:72-95](src/app/personnel/actions.ts:72)

La fonction remplace nom et prénom, vide `commentaire` et `agence_interim`. Elle
**conserve** : `matricule` — qu'elle **recopie dans le prénom** (`(12345)`) —,
`numero_badge`, `sexe`, `pointure`, `date_livret_accueil`. Elle ne touche ni
`contrat_periode` (dates, agence, motif), ni `horaire_exception.motif` (texte
libre, saisi à la main).

Un matricule et un numéro de badge sont des **identifiants indirects** : une
personne reste ré-identifiable par recoupement avec le SIRH. C'est de la
**pseudonymisation**, pas de l'anonymisation — la distinction est celle que fait
le RGPD, et l'écran affiche « anonymiser ».

**Correctif** : soit anonymiser réellement (effacer matricule, badge, pointure,
sexe, livret, et nettoyer `contrat_periode` + `horaire_exception.motif`), soit
renommer l'action « pseudonymiser » et le dire à l'écran. La première option est
la bonne ; la seconde est honnête à défaut.

### D2 — L'export de données personnelles exige un droit d'écriture — **Faible**

**Preuve** : [export/route.ts:15](src/app/api/personnel/[id]/export/route.ts:15)
exige `personnel: write`.

Exporter les données d'une personne (droit d'accès RGPD) est une opération de
**lecture sensible**, pas d'écriture. Le module `rgpd` existe déjà dans
`MODULES` — c'est lui qui devrait gouverner cette route.

---

## E. Dette et code mort

| # | Constat | Preuve | Effet |
|---|---|---|---|
| **E1** | `est_conducteur` déprécié (remplacé par `poste.categorie` en 0021) mais toujours lu dans 4 fichiers, dont **l'affichage TV** | `affichage/atelier/[atelier]/page.tsx`, `admin/referentiel/*`, `api/referentiel` | La TV classe les postes sur un champ que plus personne ne met à jour → affichage divergent des autres écrans |
| **E2** | 3 tables mortes : `equipe_quart_semaine` (0 lecture, 0 écriture), `ligne_ouverture` + `jour_equipe` (écrites par la seule route morte A4) | grep | 3 tables à migrer pour rien le jour du multi-sites |
| **E3** | `VALID_QUART = ["journee","matin","apres_midi","nuit"]` en dur | [equipes/actions.ts:74](src/app/admin/equipes/actions.ts:74) | La table `quart` est déjà traitée comme une constante : ajouter un quart ne suffit pas, il faut modifier le code |
| **E4** | `"matin"` en dur comme quart par défaut / repli legacy | `planning/page.tsx:124`, `api/placement/cell:67,149`, `api/placement/copy:53` | Même remarque, et point dur n° 1 de la refonte |
| **E5** | `const role = body?.role ?? "direction"` — rôle supprimé en 0003 | [users/create/route.ts:40](src/app/api/users/create/route.ts:40) | Une création sans rôle explicite répond 400 au lieu d'appliquer un défaut |
| **E6** | Migration `0034` écrite, non appliquée | `CLAUDE.md` | Déjà documenté ; l'écran Param. RH est en repli |
| **E7** | Zéro test sur les permissions | `src/lib/*.test.ts` : 32 tests, tous sur des règles pures (semaines, rotation, habilitations, noms, numéros, mots de passe) | Le cœur du risque — la matrice de droits — n'est couvert par **aucun** test |

---

## F. Ce qui va bien, et qu'il faut préserver

À dire, parce qu'un audit qui ne liste que les défauts donne une image fausse :

- **`fetchAll()` est correctement appliqué** partout où le volume l'exige :
  matrice (6 écrans), habilitations, planning, placement, les 6 bilans. La leçon
  L8 a été apprise, pas seulement écrite.
- **Les 26 routes API portent toutes une garde.** Aucune n'est ouverte.
- **Zéro `any`, zéro `console.log`, zéro `TODO`.** Rare, et précieux.
- **Les commentaires expliquent le pourquoi**, pas le quoi — notamment sur les
  pièges (`numero` absent vs `null` dans `/api/placement/cell`, le legacy
  `quart_code ?? "matin"`, la raison du client admin). C'est ce qui a rendu cet
  audit possible en une passe.
- **Le rollback de `/api/absence` op=save** montre que le problème d'atomicité a
  été identifié ; il n'a simplement pas été généralisé.

---

## G. Ce qui bloquera la refonte multi-sites

Classement des constats ci-dessus par leur effet **le jour de la migration**.

| Constat | Pourquoi ça bloque ou coûte |
|---|---|
| **E3 / E4** (quarts en dur) | C'est *le* point invasif annoncé. Tant que `VALID_QUART` et `"matin"` sont des constantes, « les quarts sont propres au site » est inapplicable, quelle que soit la forme des clés étrangères |
| **A6** (11 `role === "admin"`) | Deviennent des **failles inter-sites** : un admin du site A franchit la garde pour écrire sur le site B |
| **A1** (escalade `utilisateurs`) | Devient une escalade **inter-sites** : créer un compte admin sur une autre usine |
| **A2** (pas d'audit des droits) | En multi-sites, « qui a donné quel droit, sur quel site » devient une question de conformité, pas de confort |
| **B1 / B2 / B4 / B5** (écritures non atomiques et muettes) | Le nombre d'écrans de paramétrage est multiplié par le nombre de sites ; un échec silencieux devient N fois plus probable et N fois plus difficile à diagnostiquer |
| **E2** (3 tables mortes) | Chacune devrait recevoir `site_id`, une FK composite et 2 politiques RLS. Environ 10 % du travail SQL de la refonte, pour du code que personne n'exécute |
| **C1** (index de cascade manquants) | Le volume double à chaque site ajouté ; un balayage complet de `placement` à chaque suppression d'absence devient vite visible |
| **C2** (`ouverture_quart` sans `fetchAll`) | Le seuil de 1000 lignes est franchi **beaucoup plus tôt** si la lecture oublie le filtre de site |
| **E7** (aucun test de permissions) | Sans filet sur le modèle de droits actuel, impossible de prouver que la refonte ne l'a pas cassé |
| **A5** (proxy hors API) | Chaque route devra en plus filtrer par site ; sans test d'inventaire, une route oubliée ne se verra pas |

---

## H. Plan de correction proposé

Cinq lots, indépendants, ordonnés par rapport valeur/risque. **Chacun corrige un
défaut réel d'aujourd'hui et allège la refonte de demain.** Aucun n'engage le
multi-sites.

### Lot 1 — Sécurité et traçabilité (½ j + 1 migration)
- A1 : verrouiller l'attribution/retrait du rôle `admin` et la remise de lien.
- A2 : généraliser `audit_trigger` (identifiant robuste), puis le poser sur
  `app_user` et `role_permission`.
- A3 : **vérifier le dashboard Supabase** (inscription publique) — action de ta part.
- A4 : supprimer `/api/ordonnancement/toggle`.
- A6 : supprimer les 11 `role === "admin"`, et corriger `CLAUDE.md`.

### Lot 2 — Intégrité des écritures (1 j + 1 migration)
- B1, B2 : deux fonctions SQL transactionnelles (`set_rotation_reference`,
  `set_absence`) appelées en RPC.
- B4 : lire et afficher les erreurs des 16 écritures muettes.
- B3 : recopier `numero_rotation` dans la copie de journée.
- B7 : refuser au-delà de 800 jours au lieu de tronquer.

### Lot 3 — Index et lectures (½ j + 1 migration)
- C1 : quatre index sur les FK de cascade.
- C2 : `fetchAll()` + `.order()` sur les deux lectures d'`ouverture_quart`.

### Lot 4 — Nettoyage préparatoire (1 j + 1 migration)
- E2 : supprimer les 3 tables mortes (après A4).
- E1 : basculer l'affichage TV sur `poste.categorie`, retirer `est_conducteur`.
- E3, E4 : **sortir les quarts du code** — `VALID_QUART` et le quart par défaut
  lus depuis `refdata`. C'est le lot qui rend la refonte multi-sites praticable ;
  il a sa valeur propre dès aujourd'hui (ajouter un quart devient du paramétrage).
- B5, B6 : un seul chemin de création de personne, atomique, sans `catch` de transition.
- E5 : retirer le rôle fantôme `"direction"`.

### Lot 5 — Filet de tests (½ j)
- E7 : tests des permissions (`defaultsFor`, `canWriteModule` et l'exclusion du
  chef d'équipe, `canWritePlacementData`).
- A5 : test d'inventaire des routes API — chaque `route.ts` doit porter une garde.
- Ces tests sont **exactement** ceux qui serviront de non-régression le jour de
  la refonte.

### Différé, assumé
- D1, D2 (RGPD) : demandent un arbitrage — anonymiser réellement, ou renommer.
- C3 (virtualisation de la matrice) : chantier propre, ni aggravé ni résolu par
  le multi-sites.

---

## I. Ordre suggéré

**Lot 1 → Lot 3 → Lot 2 → Lot 5 → Lot 4.**

Le lot 3 (index, `fetchAll`) est le moins risqué et se déploie sans coordination.
Le lot 1 ferme une porte ouverte. Le lot 2 demande deux fonctions SQL et donc une
migration à exécuter par tes soins. Le lot 5 pose le filet **avant** le lot 4,
qui est le plus intrusif (suppression de tables, sortie des quarts du code).

Chaque lot est livrable et déployable seul.
