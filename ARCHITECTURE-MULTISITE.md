# Architecture cible — Polaris multi-sites

> **Statut : proposition, à valider avant la première migration.**
> Rédigé à partir du code réel (34 migrations, 62 fichiers accédant à Postgres).
> Les décisions du cadrage sont tenues pour acquises ; les points où le code
> réel les contredit ou les complique sont regroupés au § 0.

---

## 0. Ce sur quoi je te contredis, avant tout le reste

Quatre points. Les trois premiers demandent un arbitrage de ta part avant que
j'écrive la moindre ligne de SQL.

### 0.1 Il n'y a pas 45 politiques RLS, il y en a **63**

Le cadrage annonce 45. Le compte réel, après rejeu des 34 migrations dans
l'ordre (les `drop policy if exists` inclus) : **32 tables, 63 politiques**
(31 × `select` + 31 × `modify` + `audit_log_select` seul). Le chiffre 45
correspond exactement à l'état de la base **à la fin de la migration 0017** —
il a probablement été relevé sur une inspection ancienne. L'inventaire du § 4
est exhaustif et vérifiable : `select count(*) from pg_policies where
schemaname='public';` doit renvoyer 63 avant la bascule.

Conséquence : le chantier RLS est **40 % plus gros** qu'annoncé. Ça ne change
pas la méthode, ça change l'estimation.

### 0.2 Les quarts propres au site : je valide, mais pas comme tu l'imagines

Le cadrage redoute « 8 clés étrangères en composite ». Le compte exact est
**10 références** vers `quart.code` : `equipe.quart_fixe`, `equipe_quart_semaine`,
`jour_quart`, `ouverture_quart`, `placement.quart_code`, `horaire_poste`,
`semaine_type_quart`, `semaine_type_ouverture`, `poste_quart`,
`rotation_reference`.

Mon avis : **fais-le, et ne cherche pas de chemin moins invasif — parce que la
FK composite n'est pas un coût, c'est le principal bénéfice de la refonte.**

Détail de l'argument au § 3. En résumé : dès lors que toutes ces tables portent
`site_id` (ce que je recommande au § 1), passer la FK de `(quart_code)` à
`(site_id, quart_code)` ne coûte qu'une ligne de DDL par table, ne change **aucun
type de colonne**, ne casse **aucune ligne de TypeScript** — et rend
*structurellement impossible* qu'une ligne du site A référence un quart du
site B. C'est de la sécurité prouvée par le schéma, obtenue gratuitement.
Le chemin « moins invasif » (`quart.id uuid` de substitution) serait bien plus
cher : il change le type de 10 colonnes et casse tout le code TS qui compare
`quart_code === "matin"` et toutes les URL `?quart=matin`.

**Le vrai coût des quarts par site n'est pas en SQL, il est ailleurs** : les
constantes `"matin"` écrites en dur dans le code applicatif (§ 8.4). Il y en a
une trentaine, dont le repli historique `quart_code ?? "matin"` de
`/api/placement/cell`. Elles cessent d'être universelles le jour où un site 2
nomme ses quarts autrement.

### 0.3 Décision à prendre n° 1 : qui porte la matrice des droits, l'app ou la RLS ?

C'est le point le plus important du document.

Aujourd'hui la RLS nomme des rôles en dur (`is_admin()`, `has_role('ordo')`)
alors que c'est la matrice `role_permission` qui décide côté application. D'où
le contournement documenté dans `CLAUDE.md` : les routes d'écriture passent par
`getAdminClient()`, **qui bypasse la RLS**. 20 fichiers sur 62 l'utilisent.

En mono-site c'est un pis-aller acceptable : la RLS n'est qu'un filet.
**En multi-sites, c'est intenable** : si la RLS est bypassée sur toutes les
écritures, l'isolation entre sites ne repose plus que sur des `.eq("site_id", …)`
posés à la main dans 62 fichiers. Un oubli = une écriture croisée. « La sécurité
ne se déduit pas, elle se prouve » : avec le client admin partout, il n'y a rien
à prouver, il n'y a qu'à espérer.

Deux voies :

| | **Voie A — statu quo étendu** | **Voie B — la RLS lit la matrice** (recommandée) |
|---|---|---|
| Principe | On garde `getAdminClient()` pour les écritures, on ajoute `site_id` partout à la main | `role_permission` devient la source de vérité **en base** ; une fonction SQL `sites_avec_droit(module, niveau)` la lit ; les policies s'y réfèrent |
| Rôles en dur dans la RLS | restent | **disparaissent** (objectif du cadrage atteint) |
| Client admin | 20 fichiers | ~5 fichiers (création de comptes, écran TV public, export RGPD, amorçage d'un site) |
| Isolation site à l'écriture | applicative, non prouvable | **garantie par la base** |
| Piège « refus silencieux » de `CLAUDE.md` | reproduit à l'identique | **supprimé à la racine** |
| Coût | faible | +1 fonction SQL, + amorçage de `role_permission` à la création d'un site, réécriture des gardes de 20 routes |

Je recommande **B**. Elle a une conséquence à accepter explicitement :
`role_permission` doit être **amorcée** à la création d'un site (les défauts de
`defaultsFor()` y sont écrits), sinon un site neuf n'a aucun compte capable
d'écrire. Ça n'entre pas en conflit avec la décision 8 (« page blanche ») : les
droits ne sont pas du paramétrage métier, ce sont les serrures. Pour éviter
toute divergence entre `defaultsFor()` (TS) et le contenu de la table, l'amorçage
est **produit par l'application**, pas écrit à la main en SQL.

Le reste du document est rédigé dans l'hypothèse **B**. Si tu tranches pour A,
le § 4 change (les policies gardent des noms de rôles) mais rien d'autre.

### 0.4 Décision à prendre n° 2 : le site courant d'un compte groupe, cookie ou JWT ?

Le cadrage l'a bien vu : pour un compte groupe, la RLS autorise *tous* les sites,
et c'est l'application seule qui choisit lequel on regarde.

| | **Option A — cookie httpOnly** (recommandée) | **Option B — site dans le JWT** |
|---|---|---|
| Mécanique | cookie signé `polaris_site`, lu côté serveur | `app_metadata.site` + `refreshSession()` à chaque bascule |
| Vu par la RLS | non | oui (`auth.jwt()->'app_metadata'->>'site'`) |
| Isolation pour un compte groupe | applicative | prouvée en base |
| Coût | ~1 h | flux d'auth à remanier, latence de bascule, panne si le refresh échoue |

Je recommande **A**, pour une raison précise : **avec les FK composites du § 1.3,
la pire conséquence d'un filtre applicatif oublié devient un affichage mélangé,
pas une corruption.** La base refuse structurellement de créer une personne du
site A dans une équipe du site B, quel que soit le client utilisé. Le risque
résiduel passe de « corruption silencieuse » à « bug visible » — et à ce
niveau-là, l'option B ne vaut plus son prix. Elle reste ouverte plus tard : elle
n'invalide rien de ce qui est décrit ici.

---

## 1. Schéma cible

### 1.1 La table `site`

```sql
create table public.site (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,          -- 'usine-1', court, stable, jamais affiché
  nom        text not null,                 -- « Usine de Saint-Pierre »
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);
```

Pas de `slug` dans les URL (décision 6 : adressage automatique). `code` sert au
support et aux scripts.

### 1.2 Dénormaliser `site_id` **partout** — l'argumentaire

**Recommandation : les 32 tables métier reçoivent `site_id uuid not null`,
y compris celles qui pourraient le déduire par jointure** (`poste` ← `ligne` ←
`atelier`, `matrice` ← `personne`, `placement` ← `personne`…).

Quatre raisons, par ordre d'importance :

**(a) Une policy qui joint coûte à chaque ligne, une policy qui compare ne coûte rien.**
Écrire `using (exists (select 1 from personne p where p.id = matrice.personne_id
and p.site_id = …))` fait exécuter une sous-requête corrélée **par ligne
examinée**. Sur `/matrice`, c'est ~22 000 lignes par affichage. Postgres sait
parfois transformer un `EXISTS` corrélé en semi-jointure, mais **pas quand il est
enfermé dans une fonction `security definer` non-inlinable** — ce qui est
exactement le cas de nos helpers. On resterait sur un InitPlan rejoué par ligne.
Avec `site_id` dénormalisé, la policy devient `site_id = any(…)` : un test
scalaire, indexable, que le planificateur pousse *avant* la lecture du reste.

**(b) La forme `= any((select …))` donne un InitPlan unique par requête.**
C'est la pratique recommandée par Supabase pour `auth.uid()`, et elle se
généralise : `site_id = any((select public.mes_sites()))` évalue `mes_sites()`
**une seule fois** pour toute la requête, puis compare chaque ligne à un petit
tableau en mémoire. Sans dénormalisation, cette optimisation est hors d'atteinte
pour les tables filles.

**(c) Le filtrage applicatif devient uniforme.** `.eq("site_id", siteId)` sur
n'importe quelle table, sans avoir à savoir par quelle chaîne de jointures elle
se rattache au site. Sur 62 fichiers, l'uniformité vaut de l'or : une règle qu'on
peut vérifier mécaniquement (§ 9.3) plutôt qu'un raisonnement par table.

**(d) `fetchAll()` reste efficace.** La pagination par tranches de 1000 lignes
suppose que le filtre soit appliqué **en base**. Sans `site_id` sur `placement`,
paginer 4 sites revient à lire 4× le volume pour en jeter les trois quarts.

**Le coût, honnêtement :** 16 octets par ligne + un index par table (~1 % du
volume actuel), et une contrainte de cohérence à garantir — c'est l'objet du § 1.3.

**Exceptions** (tables qui ne reçoivent pas `site_id`) :

| Table | Pourquoi |
|---|---|
| `site` | c'est elle |
| `app_user` | reçoit `site_id` **nullable** : `null` = compte groupe (ou compte non encore rattaché, qui n'a alors accès à rien — *fail closed*) |
| `equipe_quart_semaine` | **table morte** (« conservée mais plus lue/écrite »). Je propose de la **supprimer** plutôt que de la migrer : la garder oblige à lui inventer un `site_id` et une FK composite vers `quart` pour du code que personne n'exécute |

### 1.3 Clés étrangères « cohérentes par site » — le cœur de la preuve

Ajouter `site_id` sans garde-fou permettrait d'écrire un `poste` de site A dans
une `ligne` de site B. La parade est classique et coûte deux lignes de DDL :

```sql
-- 1) sur le parent, un index unique redondant qui expose le couple
alter table public.ligne add constraint ligne_site_id_key unique (site_id, id);

-- 2) sur l'enfant, la FK porte sur le couple
alter table public.poste
  add constraint poste_ligne_fk
  foreign key (site_id, ligne_id) references public.ligne (site_id, id) on delete cascade;
```

Effet : **Postgres refuse toute ligne dont le parent est d'un autre site**, quel
que soit le client — y compris `service_role`, y compris un compte groupe, y
compris un script. C'est la garantie qui rend l'option 0.4-A acceptable.

Appliqué systématiquement, ça donne, par table enfant :

| Enfant | FK composite vers |
|---|---|
| `ligne` | `atelier (site_id, id)` |
| `poste` | `ligne (site_id, id)` |
| `equipe_chef` | `equipe (site_id, id)` — et `app_user` reste simple (un compte groupe n'a pas de site) |
| `personne` | `equipe (site_id, id)`, `atelier (site_id, id)` |
| `matrice` | `personne (site_id, id)`, `poste (site_id, id)` |
| `personne_competence` | `personne (site_id, id)`, `competence (site_id, id)` |
| `contrat_periode` | `personne (site_id, id)` |
| `placement` | `personne`, `equipe`, `poste`, `motif_absence`, `absence`, `quart (site_id, code)` |
| `absence` | `personne`, `motif_absence` |
| `horaire_exception` | `personne` |
| `horaire_poste` | `poste`, `quart` |
| `poste_quart` | `poste`, `quart` |
| `poste_competence_requise` | `poste`, `competence` |
| `ligne_ouverture` | `ligne`, `equipe` |
| `jour_equipe` | `equipe` |
| `jour_quart` | `quart` |
| `ouverture_quart` | `ligne`, `quart` |
| `rotation_reference` | `equipe`, `quart` |
| `semaine_type_quart` | `semaine_type_profil`, `quart` |
| `semaine_type_ouverture` | `semaine_type_profil`, `quart`, `ligne` |
| `equipe.quart_fixe` | `quart (site_id, code)` |
| `affichage_jeton` | `atelier (site_id, id)` |

### 1.4 Nouvelle table : les jetons d'affichage

```sql
create table public.affichage_jeton (
  id          uuid primary key default gen_random_uuid(),
  jeton       text not null unique,      -- 32 octets aléatoires, base64url : l'URL EST le secret
  site_id     uuid not null references public.site (id) on delete cascade,
  atelier_id  uuid not null,
  libelle     text not null default '',  -- « TV couloir conditionnement »
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  derniere_vue timestamptz,              -- pour repérer les écrans morts / les jetons fuités
  foreign key (site_id, atelier_id) references public.atelier (site_id, id) on delete cascade
);
```

RLS : `select`/`modify` réservés aux comptes ayant le droit `affichage` sur le
site. La page publique `/affichage/<jeton>` ne passe pas par la RLS (aucune
session) : elle utilise `getAdminClient()`, comme aujourd'hui, mais **le jeton
détermine le site**, et toutes les requêtes de la page sont filtrées dessus.

Le jeton doit être **imprévisible** (`crypto.randomBytes(32)`), jamais un uuid
d'atelier : c'est un secret porteur, révocable par `actif = false`.

---

## 2. Clés primaires et contraintes d'unicité

Règle générale : **une unicité qui contient déjà une colonne portant le site
(via une FK composite) reste inchangée** ; une unicité « globale par nature »
devient préfixée par `site_id`.

### 2.1 Unicités à préfixer par `site_id`

| Table | Aujourd'hui | Cible | Note |
|---|---|---|---|
| `quart` | `primary key (code)` | `primary key (site_id, code)` | § 3 |
| `role_permission` | `primary key (role, module)` | `primary key (site_id, role, module)` | décision 5 |
| `competence_niveau_libelle` | `primary key (niveau)` | `primary key (site_id, niveau)` | l'échelle 0-4 est paramétrable par site |
| `jour_quart` | `primary key (jour, quart_code)` | `primary key (site_id, jour, quart_code)` | |
| `ouverture_quart` | `primary key (jour, ligne_id, quart_code)` | `primary key (site_id, jour, ligne_id, quart_code)` | `ligne_id` suffirait à l'unicité, mais `site_id` doit être dans la clé pour porter la FK composite vers `quart` |
| `horaire_poste` | `primary key (poste_id, quart_code, jour)` | `primary key (site_id, poste_id, quart_code, jour)` | idem |
| `ligne_ouverture` | `primary key (jour, ligne_id, equipe_id)` | `primary key (site_id, jour, ligne_id, equipe_id)` | idem |
| `jour_equipe` | `primary key (jour, equipe_id)` | `primary key (site_id, jour, equipe_id)` | idem |
| `poste_quart` | `primary key (poste_id, quart_code)` | `primary key (site_id, poste_id, quart_code)` | idem |
| `rotation_reference` | `primary key (semaine, equipe_id)` | `primary key (site_id, semaine, equipe_id)` | idem |
| `semaine_type_quart` | `primary key (profil_id, quart_code, jour_semaine)` | `+ site_id` en tête | idem |
| `semaine_type_ouverture` | `primary key (profil_id, quart_code, ligne_id, jour_semaine)` | `+ site_id` en tête | idem |
| `poste_competence_requise` | `primary key (poste_id, competence_id)` | `primary key (site_id, poste_id, competence_id)` | idem |
| `personne` | `matricule text unique` | `create unique index … on personne (site_id, matricule) where matricule is not null` | décision 9. L'index partiel reproduit le comportement actuel (plusieurs `NULL` autorisés) |
| `agence_interim` | `unique (lower(nom))` | `unique (site_id, lower(nom))` | |
| `motif_absence` | `code_court text not null unique` | `unique (site_id, code_court)` | **absent du cadrage** — à ne pas oublier, deux sites voudront tous deux un motif « CP » |
| `site` | — | `unique (code)` | nouveau |
| `affichage_jeton` | — | `unique (jeton)` | **volontairement global** : le jeton est un secret, pas un libellé |

### 2.2 Unicités qui restent telles quelles

Parce que leurs colonnes portent déjà le site via une FK composite — les
préfixer serait du bruit, et affaiblirait même la contrainte (elle laisserait
passer un doublon si `site_id` était incohérent) :

`equipe_chef (equipe_id, app_user_id)` · `matrice (personne_id, poste_id)` ·
`personne_competence (personne_id, competence_id)` · `placement (personne_id, jour)` ·
`horaire_exception (personne_id, jour)`.

⚠️ `placement (personne_id, jour)` mérite une mention : c'est la clé de conflit
de l'`upsert` de `/api/placement/cell` (`onConflict: "personne_id,jour"`). Elle
ne change pas — donc **aucune reprise sur cet appel**, ce qui est une bonne
nouvelle vu sa complexité.

### 2.3 Ce qui n'existe pas et doit être créé

Index de scoping, un par table portant `site_id` : `create index … on <table>
(site_id)`, sauf là où la PK commence déjà par `site_id` (l'index de PK suffit).
Sur les grosses tables, préférer l'index composite qui sert aussi la requête
métier : `placement (site_id, jour)`, `matrice (site_id, personne_id)`,
`personne_competence (site_id, personne_id)`, `ouverture_quart (site_id, jour)`.

---

## 3. Le cas des quarts, en détail

`quart.code` est une PK **texte** (`'journee'`, `'matin'`, `'apres_midi'`,
`'nuit'`) référencée 10 fois. Trois options ont été pesées :

**Option 1 — PK composite `(site_id, code)`.** ✅ **Retenue.**
Les 10 FK deviennent `(site_id, quart_code) → quart (site_id, code)`. Le type
reste `text`, les valeurs restent lisibles, le code TS ne change pas de forme.
Chaque site définit ses propres quarts, libellés, horaires et ordre. Un site peut
en avoir 2, un autre 5 (« VSD »). Bénéfice majeur : **le croisement de sites
devient impossible au niveau du schéma**.

**Option 2 — PK de substitution `quart.id uuid` + `unique (site_id, code)`.**
❌ Écartée. Change le type de 10 colonnes, casse toutes les URL `?quart=matin`,
tous les tests d'égalité littérale du code TS, la clé `tp_config`, les libellés
de la vue TV. Beaucoup plus cher pour un gain nul.

**Option 3 — catalogue de codes global + surcharge par site.**
❌ Écartée. C'est le « chemin moins invasif » que tu me demandais de chercher, et
il ne tient pas : il n'évite que les FK composites (qui, une fois `site_id`
dénormalisé, sont quasi gratuites), tout en gardant un vocabulaire partagé entre
sites — donc en violant la décision 3 dès qu'un site veut un quart que les autres
n'ont pas.

**Le vrai coût est applicatif, pas relationnel.** Trois endroits à reprendre :

1. **`"matin"` en dur** comme quart par défaut (`planning/page.tsx`, `placement`,
   `/api/placement/cell`, l'affichage TV). Doit devenir « le quart d'ordre le plus
   faible **de ce site** », résolu depuis `refdata`.
2. **Le repli legacy `quart_code ?? "matin"`** de `/api/placement/cell` : il
   traite les placements historiques sans quart. Il reste juste **pour le site 1
   uniquement**. Pour les sites créés après, `quart_code` sera toujours renseigné.
   À encadrer par un commentaire explicite, sinon quelqu'un le prendra un jour
   pour une règle générale.
3. **`equipe.quart_fixe`** : FK composite, donc reprise du formulaire Équipes
   pour ne proposer que les quarts du site.

---

## 4. Inventaire exhaustif des politiques RLS

### 4.1 Les fonctions cibles

`is_admin()` et `has_role()` sont **supprimées**. `can_edit_personne()` et
`can_read_audit()` sont **réécrites**. Nouvelles fonctions :

```sql
-- Sites visibles par l'appelant. Compte normal : [son site]. Compte groupe :
-- tous les sites actifs. Compte sans site et sans rôle groupe : {} (fail closed).
create or replace function public.mes_sites() returns uuid[]
  language sql stable security definer set search_path = public as $$
  select case
    when u.role in ('admin_groupe','direction_groupe')
      then coalesce((select array_agg(s.id) from public.site s where s.actif), '{}')
    when u.site_id is not null then array[u.site_id]
    else '{}'
  end
  from public.app_user u where u.user_id = (select auth.uid()) and u.is_active
$$;

-- Sites où l'appelant détient <niveau> sur <module>, d'après role_permission
-- (VOIE B du § 0.3). direction_groupe est exclu de toute écriture.
create or replace function public.sites_avec_droit(p_module text, p_niveau text)
  returns uuid[] language sql stable security definer set search_path = public as $$ … $$;

-- Formes scalaires, pour le code hors-policy et la lisibilité des revues.
create or replace function public.can_see_site(s uuid)  returns boolean … ;
create or replace function public.is_admin_of(s uuid)   returns boolean … ;
create or replace function public.has_role_on(s uuid, r text) returns boolean … ;

-- Périmètre du chef d'équipe, désormais site-conscient.
create or replace function public.can_edit_personne(p uuid) returns boolean … ;
```

**Pourquoi les policies utilisent la forme tableau et non les scalaires.**
`using (public.can_see_site(site_id))` passe un argument qui varie par ligne :
la fonction est rappelée pour chaque ligne (22 000 fois sur `/matrice`).
`using (site_id = any((select public.mes_sites())))` évalue la fonction **une
fois** (InitPlan), puis fait un test scalaire par ligne. Même sémantique, deux
ordres de grandeur d'écart. Les scalaires demandés par le cadrage existent bien,
mais servent au code serveur et aux revues, pas aux policies chaudes.

### 4.2 Les 63 politiques, une par une

Lecture du tableau : « **L** » = `for select`, « **E** » = `for all` (modify).
`SITES` abrège `any((select public.mes_sites()))`,
`DROIT(m)` abrège `any((select public.sites_avec_droit('m','write')))`.

#### Socle authentification / droits

| # | Table | Pol. | Règle actuelle | Règle cible |
|---|---|---|---|---|
| 1 | `app_user` | L | `true` | `site_id = SITES or site_id is null` — un compte doit voir les comptes de son site **et** les comptes groupe (sinon l'écran Utilisateurs montre des lignes orphelines) |
| 2 | `app_user` | E | `is_admin()` | `site_id = DROIT(utilisateurs)`; création/rattachement d'un compte : réservé à `admin_groupe` **ou** admin du site cible ; un compte groupe n'est modifiable que par `admin_groupe` |
| 3 | `audit_log` | L | `can_read_audit()` | `site_id = any((select public.sites_avec_droit('journal','read')))` |
| 4 | `role_permission` | L | `true` | `site_id = SITES` |
| 5 | `role_permission` | E | `is_admin()` | `site_id = DROIT(utilisateurs)` + `role not in ('admin','admin_groupe','direction_groupe')` (les droits de ces rôles ne se modifient pas — règle déjà en dur dans `/api/droits`, désormais aussi en base) |

#### Référentiel structurel

| # | Table | Pol. | Actuel | Cible |
|---|---|---|---|---|
| 6-7 | `atelier` | L / E | `true` / `is_admin()` | `site_id = SITES` / `site_id = DROIT(referentiel)` |
| 8-9 | `ligne` | L / E | idem | idem |
| 10-11 | `poste` | L / E | idem | idem |
| 12-13 | `poste_quart` | L / E | idem | idem |
| 14-15 | `poste_competence_requise` | L / E | idem | idem |
| 16-17 | `equipe` | L / E | `true` / `is_admin()` | `site_id = SITES` / `site_id = DROIT(equipes)` |
| 18-19 | `equipe_chef` | L / E | idem | idem |

#### Personnel

| # | Table | Pol. | Actuel | Cible |
|---|---|---|---|---|
| 20-21 | `personne` | L / E | `true` / `is_admin()` | `site_id = SITES` / `site_id = DROIT(personnel)` |
| 22-23 | `contrat_periode` | L / E | idem | idem |

#### Compétences & habilitations

| # | Table | Pol. | Actuel | Cible |
|---|---|---|---|---|
| 24-25 | `competence` | L / E | `true` / `is_admin()` | `site_id = SITES` / `site_id = DROIT(competences) ∪ DROIT(habilitations_param)` — la table sert **deux** écrans (cf. `admin/competences/actions.ts` et `/api/habilitations-param`) |
| 26-27 | `competence_niveau_libelle` | L / E | idem | `site_id = SITES` / `site_id = DROIT(competences)` |
| 28-29 | `personne_competence` | L / E | `true` / `can_edit_personne()` | `site_id = SITES` / `site_id = DROIT(habilitations) or public.can_edit_personne(personne_id)` |
| 30-31 | `matrice` | L / E | `true` / `can_edit_personne()` | `site_id = SITES` / `site_id = DROIT(matrice) or public.can_edit_personne(personne_id)` |

> Le `or can_edit_personne(...)` conserve le **périmètre** du chef d'équipe, qui
> n'est pas un droit de module (cf. `CLAUDE.md` : `canWriteModule` renvoie
> toujours `false` pour `chef_equipe`). `can_edit_personne` est réécrite pour
> exiger en plus que la personne soit du site de l'appelant.

#### Paramétrage RH & horaires

| # | Table | Pol. | Actuel | Cible |
|---|---|---|---|---|
| 32-33 | `motif_absence` | L / E | `true` / `is_admin()` | `site_id = SITES` / `site_id = DROIT(motifs)` |
| 34-35 | `agence_interim` | L / E | idem | idem |
| 36-37 | `horaire_poste` | L / E | idem | `site_id = SITES` / `site_id = DROIT(horaires)` |

#### Ordonnancement & quarts

| # | Table | Pol. | Actuel | Cible |
|---|---|---|---|---|
| 38-39 | `quart` | L / E | `true` / `is_admin() or has_role('ordo')` | `site_id = SITES` / `site_id = DROIT(ordonnancement) ∪ DROIT(referentiel)` |
| 40-41 | `jour_quart` | L / E | idem | `site_id = SITES` / `site_id = DROIT(ordonnancement)` |
| 42-43 | `ouverture_quart` | L / E | idem | idem |
| 44-45 | `ligne_ouverture` | L / E | idem | idem |
| 46-47 | `jour_equipe` | L / E | idem | idem |
| 48-49 | `rotation_reference` | L / E | idem | `site_id = SITES` / `site_id = DROIT(ordonnancement) ∪ DROIT(equipes)` — l'écran est fusionné dans `/admin/equipes` |
| 50-51 | `semaine_type_profil` | L / E | idem | `site_id = SITES` / `site_id = DROIT(ordonnancement)` |
| 52-53 | `semaine_type_quart` | L / E | idem | idem |
| 54-55 | `semaine_type_ouverture` | L / E | idem | idem |
| 56-57 | `equipe_quart_semaine` | L / E | idem | **supprimées avec la table** (§ 1.2) |

#### Planning & placement

| # | Table | Pol. | Actuel | Cible |
|---|---|---|---|---|
| 58-59 | `placement` | L / E | `true` / `can_edit_personne()` | `site_id = SITES` / `site_id = DROIT(planning) ∪ DROIT(placement) or public.can_edit_personne(personne_id)` — reproduit `canWritePlacementData()` |
| 60-61 | `absence` | L / E | idem | `site_id = SITES` / `site_id = DROIT(planning) or can_edit_personne(personne_id)` |
| 62-63 | `horaire_exception` | L / E | idem | idem |

#### Nouvelle table

| # | Table | Pol. | Cible |
|---|---|---|---|
| 64-65 | `affichage_jeton` | L / E | `site_id = SITES` / `site_id = DROIT(affichage)` |

**Total cible : 63 − 2 (table morte supprimée) + 2 (jetons) + 2 (`site`) = 65
politiques.** La table `site` reçoit une policy de lecture (`id = SITES` — le
sélecteur des comptes groupe en a besoin) et une policy d'écriture réservée à
`admin_groupe`.

### 4.3 Comment on prouve que chacune tient

Un raisonnement par policy ne prouve rien. Le livrable est un script exécutable :
`scripts/verif-isolation.mjs` (§ 9.2). Pour **chacune des 32 tables**, il tente,
avec la session d'un compte du site A, les 4 opérations sur une ligne du site B
(`select` doit renvoyer 0 ligne, `insert`/`update`/`delete` doivent échouer ou
affecter 0 ligne) — soit **128 assertions**, plus les variantes chef d'équipe,
`direction_groupe` (lecture OK partout, écriture refusée partout) et
`admin_groupe`. Sortie tabulaire, code de retour non nul au premier échec.

---

## 5. Modèle de session

### 5.1 Résolution du site courant

Une fonction unique, `getSiteContext()` dans `src/lib/site.ts`, enveloppée dans
`cache()` comme `getCurrentProfile()` :

```ts
type SiteContext = {
  siteId: string;          // le site regardé
  siteNom: string;
  estGroupe: boolean;      // compte admin_groupe | direction_groupe
  lectureSeule: boolean;   // direction_groupe
  sitesDisponibles: {id, nom}[];  // vide si compte normal
};
```

| Type de compte | Détermination |
|---|---|
| **Compte normal** | `app_user.site_id`. Le cookie de sélection est **ignoré** — pas seulement inutilisé : lu et jeté, pour qu'un cookie forgé n'ait aucun effet |
| **Compte groupe** | cookie `polaris_site` (httpOnly, `SameSite=Lax`), **validé** contre la liste des sites actifs. Absent ou invalide → premier site actif par `code`. Le sélecteur (dans `AppHeader`) écrit le cookie via une server action puis `revalidatePath("/", "layout")` |
| **Compte sans site et sans rôle groupe** | aucun accès : `mes_sites()` renvoie `{}`, toutes les pages sont vides, la nav est vide. Redirection vers un écran « compte non rattaché ». C'est l'état d'un compte fraîchement créé par le trigger `handle_new_user` |
| **Écran TV** | aucune session. Le **jeton** dans l'URL détermine site + atelier. Le jeton inactif ou inconnu → 404 générique (ne jamais distinguer « inconnu » de « désactivé ») |

### 5.2 Conséquences sur le trigger `handle_new_user`

Aujourd'hui il insère `role='codir'` sans site. En cible, `app_user.site_id`
reste **nullable** — c'est ce qui permet au trigger de continuer à fonctionner —
et le compte n'a accès à rien tant qu'un admin ne l'a pas rattaché. La création
d'un compte via `/admin/users` renseigne `site_id` immédiatement (le site de
l'admin qui crée, ou le site choisi si `admin_groupe`).

### 5.3 Le proxy

`src/proxy.ts` change sur un point : la liste publique devient
`/affichage/<jeton>` **seulement**. L'index `/affichage` (réservé au droit
`affichage`) sort du public — il est aujourd'hui rendu public par
`pathname.startsWith("/affichage")` et ne doit sa protection qu'au
`requireModule()` de la page. Resserrer ici est gratuit.

⚠️ Le matcher du proxy exclut déjà `api/` : **aucune route API n'est protégée par
le proxy**, chacune vérifie elle-même. C'est le point d'attention n° 1 du § 8.

---

## 6. Frontière de sécurité — ce qui est garanti par qui

### 6.1 Ce que garantit la **base** (RLS + contraintes), sans confiance envers l'app

1. Un compte de site A ne **lit** aucune ligne de site B : chaque policy `select`
   compare `site_id` à `mes_sites()`.
2. Un compte de site A n'**écrit** aucune ligne de site B, y compris en forgeant
   un `site_id` dans le corps de la requête : les policies portent `with check`.
3. **Aucune ligne ne peut mélanger deux sites**, quel que soit le client — même
   `service_role`, même un script, même un compte groupe : les FK composites du
   § 1.3 le rendent impossible. C'est la garantie qui tient le tout.
4. Les droits par module sont lus **en base** depuis `role_permission` scopée par
   site (voie B), donc l'écriture d'un chef d'équipe reste bornée à son équipe et
   à son site sans que l'application ait à s'en souvenir.

### 6.2 Ce que garantit l'**application**, et elle seule

1. **Le choix du site regardé** par un compte groupe. La RLS l'autorise sur tous
   les sites ; c'est `getSiteContext()` + les `.eq("site_id", …)` qui décident
   lequel s'affiche.
2. **Le filtrage des lectures faites avec `getAdminClient()`** (bypass RLS).
   Après la refonte, il en reste ~5 usages, chacun devant filtrer explicitement :
   `refdata.ts` (paramétré par site), la page TV publique (site du jeton),
   l'export RGPD, la création de comptes, l'amorçage d'un site.
3. **La résolution du jeton d'affichage** vers un couple (site, atelier).

### 6.3 Le risque résiduel, écrit noir sur blanc

> **Pour un compte `admin_groupe` ou `direction_groupe`, la RLS n'isole rien.**
> Elle répond « oui » pour tous les sites. Un `.eq("site_id", …)` oublié dans une
> requête affichera, pour ces comptes-là, les lignes de tous les sites mélangées.
> Pour un compte normal, le même oubli est sans conséquence : la RLS filtre.

Trois atténuations, dans l'ordre d'efficacité :

- **Les FK composites bornent le dégât à l'affichage.** Un filtre oublié ne peut
  pas produire de ligne incohérente : la base la refuse. Le pire cas est une page
  qui montre trop, pas une base corrompue. C'est la raison pour laquelle je juge
  ce risque acceptable (§ 0.4).
- **`direction_groupe` n'écrit nulle part** : `sites_avec_droit()` renvoie `{}`
  pour lui quel que soit le module. Son risque se limite à la lecture.
- **Un test dédié** : le script du § 9.2 exécute un parcours complet des écrans
  avec un compte `admin_groupe` sur un site A alors que le site B contient des
  données reconnaissables, et échoue si une donnée de B apparaît.

Ce que je **ne** promets **pas** : qu'un compte groupe compromis reste confiné.
Par construction, ce compte voit tout. C'est le prix de la décision 2, et il faut
que ces comptes soient rares, nommés, et suivis.

---

## 7. Plan de migration des données vers le site 1

Découpage en **cinq migrations**, dans cet ordre, chacune enveloppée dans
`begin; … commit;` (le SQL Editor ne garantit pas la transaction implicite) :

| # | Fichier | Contenu | Réversible ? |
|---|---|---|---|
| **0035** | `site_et_colonnes.sql` | table `site` + insertion du site 1 (`code='site-1'`, nom à confirmer) ; `site_id uuid` **nullable** sur les 31 tables ; backfill `update … set site_id = <site1>` ; passage en `not null` ; index de scoping | oui (drop des colonnes) |
| **0036** | `cles_et_contraintes.sql` | `unique (site_id, id)` sur les parents ; bascule des PK et unicités du § 2 ; remplacement des FK simples par les FK composites du § 1.3 ; suppression de `equipe_quart_semaine` | difficilement — c'est le point de non-retour |
| **0037** | `fonctions_rls.sql` | nouvelles fonctions (§ 4.1) ; `drop function is_admin, has_role` ; réécriture de `can_edit_personne`, `can_read_audit`, `audit_trigger` (qui doit renseigner `audit_log.site_id`) | oui |
| **0038** | `politiques_rls.sql` | les 65 policies (§ 4.2), en `drop policy if exists` + `create policy` | oui |
| **0039** | `roles_groupe_et_jetons.sql` | `app_user.role` : contrainte étendue à `admin_groupe`/`direction_groupe` ; `app_user.site_id` ; table `affichage_jeton` + policies ; **création d'un jeton par atelier existant** pour ne pas casser les TV en service | oui |

**Le backfill est trivial** parce qu'il n'y a qu'un site : un `update` sans
`where` par table. Aucune donnée n'est réécrite au sens métier ; la colonne est
ajoutée puis remplie d'une constante. Sur les tables volumineuses (`placement`,
`matrice`, `personne_competence`), c'est un `ALTER TABLE … ADD COLUMN` suivi d'un
`UPDATE` complet : à faire **hors heures de production** (réécriture de toutes
les pages de la table + un verrou `ACCESS EXCLUSIVE` bref sur le `ALTER`).
Sur les volumes actuels (~7 000 placements/mois, 1 600 lignes de matrice), on
parle de quelques secondes.

**Ordre de bascule le jour J :**

1. Vérifier `select count(*) from pg_policies where schemaname='public'` = 63.
2. Sauvegarde (Supabase → *Database backups*, point de restauration).
3. Exécuter 0035 → 0039 dans l'ordre, dans le SQL Editor, une migration à la fois,
   en vérifiant le compte de lignes après chaque backfill.
4. Amorcer `role_permission` du site 1 : les lignes existantes reçoivent
   `site_id = <site1>` (elles sont dans le backfill de 0035) ; les modules non
   surchargés restent aux défauts TS jusqu'à l'amorçage explicite (§ 0.3).
5. Déployer la branche applicative.
6. Passer `scripts/verif-isolation.mjs` **sur la production**, avec deux comptes
   de test dans un site 2 factice créé pour l'occasion, puis supprimer le site 2.

**Rétrocompatibilité (décision 10) :** après bascule, l'usine actuelle voit
exactement la même chose. Deux exceptions visibles, à assumer :
- les URL des écrans TV changent (`/affichage/atelier/<nom>` → `/affichage/<jeton>`).
  Les TV en service doivent être repointées ; d'où la création automatique d'un
  jeton par atelier en 0039, à faire la veille pour préparer les URL ;
- l'ancienne URL doit répondre **404**, pas rediriger : rediriger supposerait de
  deviner le site.

---

## 8. Fichiers applicatifs à reprendre

**62 fichiers accèdent à Postgres** (~280 appels `.from()`). Ampleur estimée en
demi-journées de travail agent, tests inclus.

### 8.1 Socle — à écrire en premier, tout en dépend (≈ 2 j)

| Fichier | Nature de la reprise |
|---|---|
| **`src/lib/site.ts`** *(nouveau)* | `getSiteContext()`, résolution cookie/compte/jeton, server action de bascule de site |
| `src/lib/current-user.ts` | `CurrentProfile` gagne `siteId: string \| null` ; requête `app_user` étendue |
| `src/lib/permissions.ts` | **le plus gros morceau du socle.** `getPermissions(role)` → `getPermissions(role, siteId)` ; `role_permission` filtrée par site ; `defaultsFor()` gagne `admin_groupe` (tout `write`) et `direction_groupe` (tout `read`) ; `requireModule` renvoie aussi le contexte site ; `requireModuleWrite`/`moduleWriteGuard` cessent de rendre systématiquement le client admin (voie B) |
| `src/lib/roles.ts` | +2 rôles, libellés, `isRole` ; `ROLES_GROUPE` exporté |
| `src/lib/refdata.ts` | **rupture de contrat** : les 6 caches sont globaux (`unstable_cache` sur une clé fixe). Chaque clé doit inclure le `siteId`, chaque requête un `.eq("site_id", …)`. Sans ça, le cache d'un site sert un autre site — fuite silencieuse et non déterministe |
| `src/lib/supabase-server.ts` | inchangé sur le fond ; ajouter un commentaire d'avertissement sur `getAdminClient()` (« ne filtre plus rien, y compris le site ») |
| `src/proxy.ts` | liste publique resserrée sur `/affichage/<jeton>` (§ 5.3) |
| `src/lib/semaine-type.ts`, `src/lib/rotation.ts` | scoping des lectures |

### 8.2 Navigation & session (≈ 0,5 j)

`AppHeader.tsx` (le compteur d'alertes habilitations lit `personne_competence`
sans filtre → à scoper ; ajout du sélecteur de site pour les comptes groupe),
`SettingsMenu.tsx`, `UserMenu.tsx` (afficher le site courant), + un composant
`SiteSelector.tsx` neuf.

### 8.3 Les 26 routes API (≈ 3 j)

Toutes sont concernées, aucune n'est protégée par le proxy. Trois motifs :

- **11 occurrences de `profile.role !== "admin"` en dur** subsistent malgré la
  règle de `CLAUDE.md` (`/api/habilitations-param`, `/api/horaires`,
  `/api/personnel` ×3, `/api/referentiel`, `/api/users/*` ×4). En mono-site
  elles sont inoffensives (redondantes avec `defaultsFor("admin")`). **En
  multi-sites elles deviennent une faille** : un admin du site A les franchit
  pour écrire sur le site B. Elles doivent toutes disparaître au profit de la
  garde site-consciente.
- **20 fichiers utilisent `getAdminClient()`** : à ramener à ~5 (voie B).
- **Toute écriture doit poser `site_id`** explicitement, et toute lecture le
  filtrer.

Routes les plus lourdes : `/api/placement/cell` (187 l., 7 requêtes, logique
d'habilitations et de numéros de rotation), `/api/personnel` (306 l., 15
requêtes), `/api/referentiel` (191 l., 10 requêtes), `/api/absence`,
`/api/personnel/merge`.

### 8.4 Pages & server actions (≈ 4 j)

33 pages, 4 fichiers `actions.ts`. Les plus chargées :
`planning/page.tsx` (17 requêtes), `placement/page.tsx` (15),
`affichage/atelier/[atelier]/page.tsx` (9, **à réécrire en `/affichage/[jeton]`**),
`admin/equipes/actions.ts` (9), `journal/page.tsx` (8), les 6 bilans (5 à 10
chacun), `matrice/*`, `habilitations/*`, `ordonnancement/*`.

S'y ajoute la reprise des **constantes `"matin"`** (§ 3) et la création de
l'écran **`/admin/sites`** (liste des sites, création d'un site vierge avec
amorçage de `role_permission`, gestion des jetons d'affichage) — réservé à
`admin_groupe`.

### 8.5 Récapitulatif

| Lot | Fichiers | Estimation |
|---|---|---|
| Socle `src/lib` + proxy | 8 | 2 j |
| Navigation / sélecteur de site | 4 | 0,5 j |
| Routes API | 26 | 3 j |
| Pages & server actions | 37 | 4 j |
| Écrans neufs (`/admin/sites`, jetons) | 4 | 1 j |
| Migrations SQL (5 fichiers) | 5 | 1 j |
| Script de preuve + tests | 3 | 1 j |
| **Total** | **87** | **≈ 12,5 j** |

---

## 9. Risques de régression et stratégie de test

### 9.1 Risques classés

| # | Risque | Gravité | Détection | Parade |
|---|---|---|---|---|
| **R1** | **Cache `refdata` partagé entre sites** — 6 caches `unstable_cache` sur clé fixe. Un site voit les ateliers d'un autre, de façon intermittente (dépend de qui a chauffé le cache) | **Critique** | quasi nulle en test unitaire, visible en prod sous charge | clé de cache = `["refdata-ateliers", siteId]`, revue ligne à ligne des 6 caches, test dédié à deux sites |
| **R2** | **Filtre `site_id` oublié dans une lecture** (~280 appels) | **Critique** pour un compte groupe, nul pour un compte normal (RLS) | script § 9.2 + revue mécanique § 9.3 | RLS + FK composites en filet ; test de non-fuite avec `admin_groupe` |
| **R3** | **`role === "admin"` en dur** (11 occurrences) : un admin du site A écrit sur le site B | **Critique** | `grep` | suppression totale, garde site-consciente |
| **R4** | **`getAdminClient()` sur une écriture non filtrée** — bypass RLS *et* bypass site | **Critique** | revue | voie B : réduire à 5 usages, chacun commenté et filtré |
| **R5** | **Écrans TV cassés le jour de la bascule** (URL changées) | Élevée | immédiate, visible en atelier | jetons créés en 0039 la veille, URL préparées, ancienne URL en 404 explicite |
| **R6** | **Quart par défaut `"matin"` inexistant sur un site** → écran vide sans message | Élevée pour le site 2, nulle pour le site 1 | test avec un site aux quarts exotiques | résolution du quart par défaut depuis `refdata` |
| **R7** | **`fetchAll()` sans filtre de site** : lit N fois le volume, tronque | Moyenne (perf) puis Élevée (données fausses si un `.order()` devient ambigu) | test de volumétrie | `.eq("site_id")` **avant** `.order()` dans les 4 fabriques concernées |
| **R8** | **Compte orphelin** (`site_id null`, rôle non groupe) après un signup | Moyenne | test | *fail closed* + écran « compte non rattaché » |
| **R9** | **`audit_log` non scopé** : le journal du site A montre les écritures du site B | Moyenne | test | `site_id` renseigné par `audit_trigger`, policy sur `journal` |
| **R10** | **Migration 0036 non réversible** (bascule des PK) | Moyenne | — | sauvegarde préalable, exécution hors production, répétition sur une base de recette |
| **R11** | **Régression de périmètre du chef d'équipe** — `can_edit_personne` réécrite (L5 des leçons) | Moyenne | tests dédiés | 3 cas de test : sa personne / une personne d'une autre équipe / une personne d'un autre site |
| **R12** | **Perte du `numero_rotation`** : `placement (personne_id, jour)` reste la clé de conflit — si quelqu'un la « corrige » en y ajoutant `site_id`, l'`upsert` de `/api/placement/cell` casse | Faible mais sournoise | test de placement | § 2.2, ne pas toucher |

### 9.2 Le script de preuve — `scripts/verif-isolation.mjs`

Exécutable, sans DDL, lisant `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`
(pattern déjà autorisé par `CLAUDE.md` pour la *donnée*). Déroulé :

1. **Montage** (service_role) : crée un site A et un site B factices, un jeu
   minimal de données dans chacun (atelier → ligne → poste, équipe, personne,
   quart, un placement, une ligne de matrice), et 5 comptes :
   `admin@A`, `chef@A` (chef d'une équipe de A), `admin@B`,
   `groupe-admin` (`admin_groupe`), `groupe-lecture` (`direction_groupe`).
2. **Épreuves** : pour chacune des 32 tables, avec la session de `admin@A`
   (client anon, RLS active), 4 tentatives sur une ligne **du site B** :
   - `select` → doit renvoyer **0 ligne** ;
   - `insert` d'une ligne portant `site_id = B` → doit **échouer** ;
   - `update` → doit affecter **0 ligne** ;
   - `delete` → doit affecter **0 ligne**.
3. **Épreuves croisées** : `insert` d'une ligne du site A référençant un parent
   du site B → doit échouer **par la FK composite** (prouve le § 1.3) ;
   `chef@A` sur une personne d'une autre équipe de A → refusé ;
   `groupe-lecture` en écriture partout → refusé ; `groupe-admin` → accepté.
4. **Démontage** et rapport : un tableau `table / opération / attendu / obtenu`,
   `process.exit(1)` au premier écart.

Cible : **≈ 150 assertions vertes**. C'est ce fichier qui « prouve », pas ce
document.

### 9.3 Revue mécanique du scoping

Un second script, `scripts/verif-scoping.mjs`, purement statique : il parcourt
`src/`, repère chaque chaîne `.from("<table>")` et vérifie qu'elle est suivie,
dans la même expression, d'un `.eq("site_id"` — ou qu'elle figure dans une liste
d'exemptions **commentée**, fichier par fichier (les tables sans `site_id`, les
lectures déjà bornées par une FK du bon site). Faillible (analyse textuelle),
mais il transforme « on a relu 280 appels » en « 280 appels sont couverts, 12
sont exemptés pour ces raisons ». À lancer dans `npm test`.

### 9.4 Tests unitaires (Vitest, 6 fichiers aujourd'hui)

À ajouter : `site.test.ts` (résolution du site courant : compte normal ignore le
cookie / compte groupe le respecte / cookie invalide → repli / compte orphelin →
aucun site), `permissions.test.ts` (défauts des deux rôles groupe, refus
d'écriture de `direction_groupe`, exclusion du chef d'équipe préservée).

### 9.5 Performance — réponse à la question posée

**Le scoping par site ne dégrade rien, et améliore même les lectures.**

- Les policies passent de `using (true)` (aucun coût) à `site_id = any(<InitPlan>)`
  (un test scalaire par ligne, sur une colonne indexée). Sur 22 000 lignes,
  l'ordre de grandeur est la milliseconde. La forme tableau du § 4.1 est ce qui
  garantit ce chiffre : la forme scalaire naïve, elle, coûterait 22 000 appels de
  fonction.
- Les requêtes gagnent un `.eq("site_id", …)` **sélectif** : avec 4 sites, chaque
  page lit ~4× moins de lignes qu'elle n'en lirait sans filtre.
- Le coût de `sites_avec_droit()` (voie B) est d'une lecture de `role_permission`
  — quelques dizaines de lignes — par requête HTTP, mise en InitPlan.

**La virtualisation des grandes grilles ne devient pas bloquante à cause du
multi-sites** : `/matrice` construit ~22 000 cellules **pour un site**, et ce
chiffre ne bouge pas quand on en ajoute d'autres. Le plafond documenté dans
`CLAUDE.md` (1,8 Mo de HTML, hydratation lourde) reste ce qu'il est : un problème
de **rendu**, pas de requête, et il reste le prochain gros chantier — après
celui-ci, pas pendant.

**Le vrai risque de performance est R7** : une lecture qui oublie le filtre de
site paie N fois le volume *et* peut retomber dans le piège L8 (troncature
silencieuse à 1000 lignes) sur des tables devenues N fois plus grosses.
Les quatre fabriques `fetchAll()` (`matrice`, `personne_competence`,
`placement`, `ouverture_quart`) doivent poser `.eq("site_id")` **avant**
`.order()`.

---

## 10. Ce qu'il me faut de toi pour démarrer l'étape 2

1. **Arbitrage § 0.3** : voie A ou voie B pour la matrice des droits.
   *(Ma recommandation : B.)*
2. **Arbitrage § 0.4** : cookie ou JWT pour le site courant d'un compte groupe.
   *(Ma recommandation : cookie.)*
3. **Le nom et le code du site 1** (`code='site-1'` ? nom affiché ?).
4. **Confirmation de la suppression** de `equipe_quart_semaine` (table morte).
5. **Confirmation** que les écrans TV peuvent être repointés le jour de la
   bascule (combien d'écrans, qui s'en charge).
6. **Confirmation** qu'un site neuf reçoit bien un amorçage de `role_permission`
   (les droits, pas le paramétrage métier) — sans quoi il naît inutilisable.
