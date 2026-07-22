# Prompt — refonte multi-sites de Polaris

> Document de cadrage. Le contenu à copier comme prompt commence à
> « ## PROMPT À UTILISER ». Ce qui précède est le résumé des décisions prises,
> à garder pour mémoire.

## Décisions actées (JF Gautreau, 22/07/2026)

| Sujet | Décision |
|---|---|
| Isolation | **Une seule base**, colonne `site_id` + RLS. Un seul projet Supabase, un seul déploiement Vercel. |
| Utilisateurs | **Un compte = un site**, sauf deux rôles groupe. |
| Rôles groupe | **`admin_groupe`** (écriture partout) et **`direction_groupe`** (lecture partout), distincts. |
| Paramétrage | **Tout est propre au site** : ateliers, lignes, postes, équipes, **quarts**, compétences, habilitations, motifs, agences, horaires, semaines types. |
| Consolidation | **Aucune.** Pas de rapport groupe, pas de comparaison inter-sites. |
| Matrice des droits | **Propre à chaque site** (`role_permission` gagne `site_id`). |
| Adressage | **Automatique** : le compte détermine le site. Une seule URL. Les comptes groupe obtiennent un sélecteur de site. |
| Écrans TV | **Jeton d'affichage par écran** (table de jetons, révocables). L'accès public par nom d'atelier disparaît. |
| Création d'un site | **Page blanche** : aucun paramétrage pré-rempli. |
| Mobilité des personnes | **Aucune.** Une personne appartient à un site, définitivement. Matricule unique **par site**. |
| Mise en service | L'existant devient le **site 1**, migration rétrocompatible ; les autres sites arrivent ensuite. |
| Rythme | **Refonte en une fois, sur une branche.** |

## Points durs identifiés lors du cadrage

1. **`is_admin()` doit disparaître.** Le statut « admin » est aujourd'hui global et
   garde 45 politiques RLS. Il devient « admin **de tel site** ». C'est un
   remaniement des 45 politiques, pas un ajout.
2. **Les quarts propres au site sont le morceau le plus invasif.** `quart.code` est
   une clé primaire texte référencée par clé étrangère depuis 8 tables. Passer en
   `(site_id, code)` fait basculer toutes ces clés en composite.
3. **Le rôle groupe crée une exception au modèle de sécurité.** La RLS porte le
   *droit d'accès* (« ce compte a-t-il le droit de voir ce site ? »), l'application
   porte la *sélection* (« quel site je regarde »). Pour un compte groupe, un oubli
   de filtre applicatif montre les données d'un autre site. Acceptable car ces
   comptes sont rares et de confiance — mais à écrire noir sur blanc.
4. **Les écrans TV n'ont pas de compte** : ils ne peuvent pas déduire leur site.
   D'où les jetons.

---

## PROMPT À UTILISER

Tu vas conduire la refonte multi-sites de **Polaris**, application de gestion des
plannings d'une usine agroalimentaire (Next.js 16 App Router, React 19,
TypeScript, Supabase Postgres + Auth + RLS, déployée sur Vercel).

Lis `CLAUDE.md` en premier : il contient le brief agent, les règles de travail non
négociables, les pièges métier et les patterns UI. Lis ensuite `ARCHITECTURE.md`
et `tasks/lessons.md`.

### L'objectif

L'application est aujourd'hui **mono-site**. Elle doit devenir **multi-sites** :
plusieurs usines, chacune indépendante et paramétrable intégralement, sans
qu'aucune ne voie les données d'une autre.

### Les décisions déjà prises — ne les remets pas en cause

1. **Une seule base Postgres**, une seule instance Supabase, un seul déploiement
   Vercel. L'isolation passe par une colonne `site_id` et la RLS.
2. **Un compte utilisateur appartient à un seul site**, sauf deux rôles groupe :
   - `admin_groupe` : peut administrer n'importe quel site (écriture) ;
   - `direction_groupe` : peut consulter n'importe quel site (lecture seule).
3. **Tout le paramétrage est propre au site**, y compris les **quarts**, les
   compétences, les habilitations, les motifs d'absence et les agences d'intérim.
   Rien n'est partagé entre sites.
4. **Aucune consolidation inter-sites.** Pas de cockpit groupe, pas de comparaison.
   Les rôles groupe servent à administrer et à consulter site par site, pas à
   agréger.
5. **La matrice des droits est propre à chaque site** : `role_permission` gagne
   `site_id`. Un chef d'équipe peut donc avoir des droits différents selon l'usine.
6. **L'adressage est automatique** : une seule URL. À la connexion, l'application
   déduit le site du compte. Un compte groupe voit un sélecteur de site ; son choix
   est mémorisé côté session.
7. **Les écrans TV passent par des jetons d'affichage.** Une table de jetons
   (site, atelier, libellé, actif, date de création) ; l'URL publique devient
   `/affichage/<jeton>`. L'ancien accès `/affichage/atelier/<nom>` disparaît :
   il ne peut pas désigner un site, et deux usines peuvent avoir un atelier
   homonyme.
8. **Un nouveau site part d'une page blanche.** Aucun paramétrage pré-rempli,
   aucune duplication depuis un site existant.
9. **Une personne appartient à un seul site, définitivement.** Pas de mutation,
   pas de partage entre usines. `personne.matricule` devient unique **par site**
   et non plus globalement.
10. **L'existant devient le site 1.** La migration doit être rétrocompatible :
    à l'issue de la bascule, l'usine actuellement en production ne doit voir
    aucune différence fonctionnelle.
11. **Refonte en une fois, sur une branche dédiée.** Pas de livraison par
    tranches sur `main`.

### Ce que je te demande de produire, dans cet ordre

**Étape 1 — Le document d'architecture cible.** Avant toute ligne de code, écris
`ARCHITECTURE-MULTISITE.md` contenant :

- le schéma cible : quelles tables reçoivent `site_id`, lesquelles le déduisent
  par clé étrangère, et **pourquoi tu recommandes ou non de le dénormaliser
  partout** (la RLS avec jointure coûte cher ; argumente) ;
- le sort de chaque clé primaire et de chaque contrainte d'unicité impactée. Au
  minimum : `quart.code`, `role_permission (role, module)`,
  `jour_quart (jour, quart_code)`, `ouverture_quart (jour, ligne_id, quart_code)`,
  `horaire_poste (poste_id, quart_code, jour)`, `personne.matricule`,
  `agence_interim lower(nom)` ;
- **l'inventaire exhaustif des 45 politiques RLS existantes**, avec pour chacune
  la règle cible. `is_admin()` et `has_role()` disparaissent au profit de
  fonctions site-conscientes (`is_admin_of(site)`, `has_role_on(site, role)`,
  `can_see_site(site)`) ;
- le modèle de session : comment le site courant est déterminé pour un compte
  normal, pour un compte groupe, et pour un écran TV ;
- **la frontière de sécurité, écrite explicitement** : ce que garantit la RLS, ce
  que garantit l'application, et où se situe le risque résiduel pour les comptes
  groupe ;
- le plan de migration des données existantes vers le site 1 ;
- la liste des fichiers applicatifs à reprendre, avec l'ampleur estimée. Le socle
  est au minimum : `src/lib/{permissions,roles,current-user,refdata,supabase-server}.ts`,
  `src/proxy.ts`, `src/components/{AppHeader,SettingsMenu,UserMenu}.tsx`, et
  **toutes** les routes sous `src/app/api/` ;
- les risques de régression classés, et la stratégie de test associée.

**Arrête-toi là et présente-moi ce document.** Je le valide avant que tu écrives
la moindre migration.

**Étape 2 — L'implémentation**, une fois le document validé.

### Contraintes impératives

- **Tu n'exécutes jamais de DDL toi-même.** `SUPABASE_DB_URL` est vide et le MCP
  Supabase pointe sur un autre compte. Tu écris les migrations numérotées dans
  `supabase/migrations/` et tu me demandes de les exécuter dans le SQL Editor.
  La dernière migration appliquée est la `0034`.
- **`npm run build` doit passer avant chaque commit**, et `npm test` aussi.
- **La sécurité ne se déduit pas, elle se prouve.** Pour chaque politique RLS
  réécrite, indique comment tu vérifies qu'un compte du site A ne peut pas lire
  ni écrire une donnée du site B. Un script de vérification exécutable vaut mieux
  qu'un raisonnement.
- **Attention au piège documenté dans `CLAUDE.md`** : une route API qui écrit
  dans une table de paramétrage ne doit jamais se contenter de `getServerClient()`.
  Ces RLS nomment des rôles en dur et refusent en silence tout titulaire du droit
  qui ne porte pas ce rôle. Le remaniement multi-sites doit supprimer ce risque,
  pas le reproduire.
- **`fetchAll()` reste obligatoire** pour toute lecture pouvant dépasser 1000
  lignes (`matrice`, `personne_competence`, `placement`, `ouverture_quart`).
  Le multi-sites fait mécaniquement grossir ces tables : revois les endroits qui
  lisent sans filtre de site.
- **Performance** : `/matrice` construit déjà ~22 000 cellules pour un seul site.
  Vérifie que le scoping par site ne dégrade pas les temps de réponse, et signale
  si la virtualisation des grandes grilles devient bloquante.
- Réponds en français. Commits en français, style conventional commit, trailer
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

### Ce sur quoi je veux que tu me contredises

Si une de mes décisions te paraît coûteuse ou risquée au vu du code réel, dis-le
avant de l'appliquer. En particulier : rendre les **quarts** propres au site fait
passer 8 clés étrangères en composite ; si tu vois un chemin moins invasif qui
préserve l'indépendance des sites, propose-le.
