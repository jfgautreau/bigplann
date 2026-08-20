# Polaris multi-site — analyse et proposition d'architecture

> **Statut : STANDBY (2026-08-20).** Le socle et le back-office sont en prod. On
> attend un vrai 2e site pour attaquer PR 4 (onboarding) et PR 5 (tests
> statiques). Reprise à froid → voir « Où on en est » ci-dessous avant tout.
>
> ---
>
> ## Où on en est (2026-08-20)
>
> **✅ FAIT — livré en prod (Vercel bigplann.vercel.app)** :
>
> | PR | Contenu | Migrations |
> |----|---------|------------|
> | **PR 1** | Socle : table `site` + `lebignon`, `site_id` sur 33 tables, RLS réécrite via `current_site_id()`, trigger `set_site_id_from_context`, helpers app (`getCurrentSite`, `refdata` sitisé, pastille site dans AppHeader), `app_user.est_super_admin` | `0043` |
> | **PR 1b** | Fixes : fonctions SQL prennent `p_site` explicite (`0044`) ; `audit_trigger` tolérant aux PK non-`id` (`0045`) ; FKs simples restaurées (`0046`) ; composite FKs retirées à cause de l'ambiguïté d'embed PostgREST (`0047`) — cf. `tasks/lessons.md L25` | `0044-0047` |
> | **PR 2** | `site.nom` en pastille du logo (AppHeader), en pied du PDF placement, à côté du titre atelier sur la TV ; refus de session si `site.statut != 'actif'` (sauf super_admin) | — |
> | **PR 3** | Back-office `/platform` : liste sites, création (avec 1er admin + lien mdp), suspendre/réactiver/archiver, impersonation super_admin via cookie signé HMAC-SHA256 + header PostgREST + bandeau rouge permanent + journal `audit_impersonation` ; layout `/platform` réservé aux super_admin | `0048` (current_site_id lit `x-impersonate-site`) |
>
> **⏸️ STANDBY — décisions et code à faire quand un vrai 2e site sera en vue** :
>
> - **PR 4 — Onboarding automatique** : à la création d'un site depuis `/platform`,
>   copier les référentiels partagés (motifs d'absence groupe → visibles automatiquement
>   via `site_id IS NULL` déjà, donc rien à copier ; types de contrat idem ; rôles
>   idem). Le socle est déjà multi-tenant, la création marche → PR 4 concerne
>   surtout les *contenus initiaux propres au site* (semaine-type par défaut,
>   quart-code disponible, agences intérim locales à seeder ou à laisser vide).
>   Cf. §8 pour le plan détaillé.
>
> - **PR 5 — Tests statiques cross-site** :
>   - `routes-multi-site.test.ts` : toute route API écrivant une table
>     site-scopée doit poser `.eq("site_id", …)` ou passer par une fonction SQL
>     avec `p_site`.
>   - `refdata-cache.test.ts` : tout `unstable_cache(...)` sur donnée site-scopée
>     doit inclure `siteId` dans sa clé.
>   - `admin-client.test.ts` : `getAdminClient()` recensé dans un test qui vérifie
>     qu'aucun appel n'oublie de borner par site. Whitelist manuellement les
>     rares cas légitimes (`/platform`, refdata partagée).
>
> - **PR 6+ — Reporting groupe, quotas, custom domains** : reporté à V2, cf. §10.
>
> **Points ouverts à trancher quand on reprend** :
>
> 1. **Domaine `polaris.app`** : pas acheté, on tourne toujours sur
>    `bigplann.vercel.app`. Le middleware ne résout pas de sous-domaine, il
>    hardcode le site `lebignon`. Quand `polaris.app` sera là, ouvrir wildcard
>    DNS + adapter `src/proxy.ts` pour lire le slug du host, et migrer les URLs
>    en pointant chaque site sur son sous-domaine.
> 2. **Multi-appartenance utilisateur** : refusée en V1 (choix round 1). Si un
>    besoin remonte (CODIR groupe, personne détachée), voir dans les échanges
>    du 2026-08-20 : la contrainte `auth.users.email` unique global oblige à
>    passer par des alias `+` Gmail ou à réformer app_user vers une table de
>    jointure `app_user_site`.
> 3. **Composite FKs** — retirées en 0047 par nécessité PostgREST. Si un jour on
>    voulait remettre la garantie base, il faudra ajouter des hints explicites
>    partout : `.select("ligne!ligne_atelier_id_fkey(...)")`. Cf. §3.4.
>
> ---
>
> **Décisions cadrantes arrêtées** (session du 2026-08-19, toutes toujours valides) :
> 1. **Isolation** — shared DB Supabase + `site_id` sur toutes les tables métier + RLS.
> 2. **Utilisateur × site** — 1 compte = 1 site (pas de multi-appartenance).
> 3. **Référentiels** — postes / ateliers / lignes / équipes / quarts / compétences
>    **par site** ; catalogue d'habilitations, motifs d'absence, types de contrat et
>    matrice de droits **partagés au niveau groupe avec possibilité de surcharge locale**.
> 4. **URL / déploiement** — un sous-domaine par site sur **`polaris.app`**
>    (`lebignon.polaris.app`, `usine-x.polaris.app`, …), un seul projet Vercel + un seul
>    projet Supabase. Wildcard DNS `*.polaris.app`.
> 5. **Gouvernance** — champ dédié `app_user.est_super_admin` (booléen, hors matrice des
>    rôles), porté par un cercle restreint (toi + équipe Polaris). Back-office
>    `platform.polaris.app`. **Le statut super_admin est invisible dans la liste des
>    utilisateurs d'une usine** (n'apparaît jamais dans `/admin/users`).
> 6. **Support à distance** — bouton « Entrer dans le site » depuis `/platform` qui
>    connecte le super_admin comme un utilisateur de l'usine cible, avec **bandeau
>    rouge permanent** et **journal complet** des actions (`audit_impersonation`).
> 7. **Reporting groupe** — hors V1 (mais `site_id` partout laisse la porte ouverte).
> 8. **Onboarding** — création d'un site vierge + recopie des référentiels partagés,
>    saisie manuelle du référentiel local.
> 9. **Migration** — big-bang `0043`, tout le legacy réécrit au site historique
>    **`lebignon`** (slug + nom d'affichage `Lebignon`, modifiables plus tard depuis
>    `/platform` sans migration).
> 10. **Cohérence référentielle** — **composite FKs `(id, site_id)`** sur les tables
>     sensibles (`placement`, `personne_competence`, `ouverture_quart`, `jour_quart`,
>     `poste_competence_requise`, `absence`, `contrat_periode`, `personne_horaire_*`,
>     `semaine_type_*`, `equipe_quart_semaine`, `rotation_reference`). Postgres refuse
>     à la base tout mélange inter-sites — ceinture + bretelles.
> 11. **Cycle de vie** — suspension logique (`site.statut`) + purge sur demande
>     manuelle.
> 12. **Facturation** — hors V1 (mais `site.plan` / `site.quota_*` prévus en table
>     pour brancher Stripe plus tard sans refactor).

---

## 1. Ce qui est mono-site aujourd'hui (audit rapide)

Tout, sans exception. Il n'existe **aucune notion de site** dans l'app :

- **Base** — 60+ tables métier, aucune ne porte de `site_id`. Les FK, unicités et RLS
  supposent implicitement une seule usine. Exemples typiques : `personne.matricule`
  unique global, `poste.code` unique global, `atelier.nom` unique global, `competence.code`
  unique global, `equipe.code` unique global.
- **Auth** — `app_user` porte un `role` unique global. `getCurrentProfile()` ignore la
  notion de site. Les gardes (`requireModule`, `moduleWriteGuard`, `can_edit_personne`,
  `verifierChangementDroit`, `droitsCouvertsPar`) raisonnent en droit absolu, sans
  périmètre géographique.
- **RLS** — les policies parlent de `is_admin()`, `has_role(...)`, `can_edit_personne(...)` ;
  aucune ne filtre par site.
- **Cache & refdata** — `refdata.ts` mémorise via `unstable_cache` avec une **clé
  globale** ; pareil pour les données de rotation, l'ordonnancement, la fenêtre TV.
- **URL** — `/planning`, `/matrice`, `/admin/*`, `/affichage/atelier/[atelier]` : rien
  qui identifie un site.
- **Métier** — `src/lib/quarts.ts`, `src/lib/rotation.ts`, `src/lib/semaine-type.ts`,
  `src/lib/parametres.ts` supposent tous *un* jeu de quarts, *une* semaine-type,
  *un* jeu de paramètres.
- **Ossature UI** — le logo, le nom de l'app, les entêtes, le PDF de placement, la
  bannière TV : aucun n'affiche de nom d'usine.

Bref, le multi-site est un chantier structurel, pas une évolution de bord.

## 2. Modèle cible

### 2.1 La table `site`

```sql
create table site (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,          -- sous-domaine (usine-a)
  nom               text not null,                 -- affiché partout
  statut            text not null default 'actif'
                    check (statut in ('actif','suspendu','archive')),
  fuseau            text not null default 'Europe/Paris',
  cree_le           timestamptz not null default now(),
  cree_par          uuid references auth.users(id),

  -- crochets pour la V2 (facturation, quotas)
  plan              text,                          -- 'starter','pro'…, null en V1
  quota_personnes   int,
  quota_utilisateurs int,

  -- branding (facultatif en V1)
  logo_url          text,
  accent            text                           -- hex, pour surcharger --accent
);
```

- `slug` = sous-domaine (`usine-a` → `usine-a.polaris.app`) ; réservé
  (`admin`, `platform`, `api`, `www`, `auth`… en blacklist applicative).
- `statut` piloté depuis `/platform`. `suspendu` = login refusé (message clair,
  aucune session créée). `archive` = lecture seule accessible uniquement au
  `super_admin` pour audit ; les utilisateurs finaux ne peuvent plus se connecter.
- Fuseau prévu pour l'internationalisation future. En V1 tous les sites sont
  `Europe/Paris`, mais chaque calcul temporel (rotation, expiration, absences)
  passera par `site.fuseau` **dès le départ** — c'est beaucoup moins coûteux
  maintenant que plus tard.

### 2.2 Le contexte site sur chaque requête

Un middleware Next (`src/proxy.ts`, déjà présent) devient le point unique où le site
est résolu :

```
host = 'usine-a.polaris.app'
  → slug = 'usine-a'
  → site = SELECT id, statut, nom FROM site WHERE slug = 'usine-a' AND statut != 'archive'
  → pose header 'x-site-id' + cookie technique (facultatif)
  → si super_admin en impersonation : lit le cookie 'polaris-impersonate' (site_id signé)
```

- Le host racine `polaris.app` (sans sous-domaine) → landing publique + `/login`
  de la plateforme, redirection vers `slug.polaris.app` après authentification.
- Le sous-domaine `platform.polaris.app` → back-office super_admin (voir §5).
- La fonction `getCurrentSite()` (nouveau, dans `src/lib/current-site.ts`) lit le
  header injecté par le middleware et le sert aux server components et server
  actions. **Aucun composant serveur ne doit rechercher `site_id` autrement.**

### 2.3 `app_user` × site

- Ajout d'une colonne `app_user.site_id uuid not null references site(id)` — un
  compte appartient à un et un seul site (choix de round 1).
- L'unicité de `auth.users.email` est **globale Supabase** : deux personnes de deux
  usines qui utilisent le même email = interdit. On l'accepte. Si un cas se
  présente, on demande un alias (`prenom.nom+usinea@…`). Alternative : le
  `super_admin` peut « déplacer » un compte (`UPDATE app_user.site_id`), ce qui
  ne casse rien puisque le lien passe par `auth_user_id`.
- `role` reste une colonne texte comme aujourd'hui. Les rôles intégrés restent
  définis dans `src/lib/roles.ts` ; les rôles personnalisés (`role_custom`)
  gagnent un `site_id` **nullable** : `NULL` = rôle groupe visible partout,
  sinon = rôle propre à ce site.
- `super_admin` = nouveau rôle **hors matrice site**, stocké sur un champ dédié
  `app_user.est_super_admin boolean not null default false` (pas dans `role`, pour
  qu'il ne puisse pas être accordé accidentellement depuis l'écran Droits). Le
  super_admin n'a **aucun droit métier** par défaut ; il n'ouvre les écrans que via
  l'impersonation (§5).

## 3. Isolation des données — plan par table

### 3.1 Tables qui gagnent `site_id NOT NULL`

Toutes les tables métier locales :

- Structure : `atelier`, `ligne`, `poste`, `equipe`, `quart`.
- Personnes : `personne`, `personne_horaire_standard`, `personne_horaire_exception`.
- Placement / plan : `placement`, `jour_quart`, `ouverture_quart`, `poste_quart`.
- Rotation : `rotation_reference`, `equipe_quart_semaine` (conservée mais gagne
  quand même `site_id` pour ne pas garder de tables « à moitié multi-tenant »).
- Contrats & périodes : `contrat`, `periode` (agences d'intérim), `absence`.
- Semaine-type / ordonnancement : `semaine_type`, `semaine_type_ligne`,
  `semaine_type_poste`.
- Paramétrage local : `parametre`, `poste_competence_requise`, `personne_competence`
  (voir §3.3 pour la nuance sur `competence`).
- Journal métier : toutes les tables `journal_*` gagnent `site_id`.

### 3.2 Unicités à réécrire (par site)

Toute contrainte `unique(code)` devient `unique(site_id, code)`. Inventaire non
exhaustif (à faire précisément dans la PR de migration) :

- `atelier.nom`, `ligne.code`, `poste.code`, `equipe.code`, `quart.code`.
- `personne.matricule`.
- `equipe(code)` × `quart(code)` × `numero_semaine` sur `equipe_quart_semaine`.
- Toutes les tables de liaison qui ont un `unique(a_id, b_id)` restent naturellement
  correctes puisque `a_id` et `b_id` sont eux-mêmes site-scopés — pas besoin de
  toucher.

### 3.3 Tables partagées (référentiel groupe)

Ces tables ne prennent **pas** `site_id`, ou prennent un `site_id NULLABLE` (NULL =
ligne groupe, visible partout) :

- **`competence`** — catalogue global d'habilitations. `site_id` nullable :
  - `NULL` = habilitation groupe (CACES, habilitation électrique, hygiène…).
  - `<site>` = habilitation propre à cette usine si un site en a besoin (rare).
  - Une vue `v_competence_visible(site_id)` renvoie l'union
    `WHERE competence.site_id IS NULL OR competence.site_id = :site`.
- **`motif_absence`** — idem, `site_id` nullable.
- **`type_contrat`** — idem, `site_id` nullable.
- **`role_custom`** — idem, `site_id` nullable (rôles groupe utiles pour tous les
  sites du parc, rôles locaux pour un besoin spécifique).
- **`role_permission`** — idem, `site_id` nullable. Résolution : pour un `(role,
  module)`, la ligne prise est celle de `site_id = :site` si elle existe, sinon
  la ligne `site_id IS NULL`, sinon le défaut applicatif (`defaultsFor()`).

### 3.4 Cohérence référentielle multi-site (le vrai piège) — CHOIX RÉVISÉ 2026-08-20

RLS ne protège pas des mauvais FK inter-sites : rien n'empêche un bug applicatif
de poser un `placement` qui pointe vers un `poste` du site A et une `personne`
du site B.

**Choix initial (0043 §G) : composite FKs** `(child_id, site_id) →
parent(id, site_id)`. Postgres refuse alors, à la base, tout enfant qui pointe
vers un parent d'un autre site. Ceinture idéale.

**Retour d'expérience (0046, 0047)** : les composite FKs sont **incompatibles
avec les embeds implicites de PostgREST**. Toute requête du type
`.select("id, ligne(id)")` échoue avec
`Could not find a relationship` (ou, si on ajoute les FKs simples en parallèle,
`more than one relationship was found`). Supabase JS ne throw pas — la page
s'affiche vide sans erreur. Cf. `tasks/lessons.md L25`.

**Décision retenue en V1a (migration 0047)** : les composite FKs sont **retirées**.
Seules les FKs simples `(child.parent_id) → parent(id)` restent — PostgREST
peut embed sans hint. La garantie « aucun mélange inter-sites » est portée
par les **bretelles** :
- **RLS** : chaque policy exige `site_id = current_site_id()`. Un chef d'équipe
  du site A ne peut pas voir ni écrire une ligne du site B.
- **Trigger `set_site_id_from_context`** : à chaque INSERT, `site_id` est
  posé automatiquement depuis le contexte utilisateur (fallback lebignon en
  V1a). Un bug applicatif qui « oublie » `site_id` ne crée pas d'orphelin.
- **Tests cross-site (PR 5, à venir)** : intégration Supabase avec deux sites
  et deux comptes, chaque `select` ne rend que les lignes du site courant.

**Trade-off assumé** : un bug applicatif qui poserait explicitement un
`placement.poste_id` d'un poste d'un autre site n'est plus refusé à la base —
seul la RLS le bloque. Vu l'archi 1 compte = 1 site (round 1), c'est
acceptable en V1a. En V2, quand plusieurs sites tourneront ensemble, on pourra :
1. Remettre les composite FKs **en parallèle** des simples,
2. Réécrire toutes les queries d'embed avec des hints explicites
   (`.select("ligne!ligne_atelier_id_fkey(...)")`) pour désambiguïser
   PostgREST,
3. Ajouter un test statique qui échoue si une query utilise l'embed implicite
   sans hint.

Tables où la question se pose (toutes les FKs enfants site-scopées) :
`placement`, `ouverture_quart`, `jour_quart`, `poste_quart`,
`poste_competence_requise`, `personne_competence`, `absence`, `contrat_periode`,
`horaire_poste`, `horaire_exception`, `semaine_type_*`, `equipe_quart_semaine`,
`rotation_reference`, `ligne_ouverture`, `jour_equipe`, `matrice`, `equipe_chef`,
`ligne`, `poste`, `personne`, `equipe_chef`.

### 3.5 RLS — remplacement systématique

Toutes les policies actuelles sont réécrites autour d'une helper fonction :

```sql
create or replace function public.current_site_id()
returns uuid
language sql stable security invoker as $$
  select site_id from app_user where auth_user_id = auth.uid()
$$;
```

Pattern de policy :

```sql
-- lecture : appartenance au site + droit module
create policy personne_select on personne for select
  using (site_id = public.current_site_id());

-- écriture : idem + droit métier existant
create policy personne_update on personne for update
  using  (site_id = public.current_site_id() and public.can_edit_personne(personne.id))
  with check (site_id = public.current_site_id() and public.can_edit_personne(personne.id));
```

Pour les tables partagées à `site_id NULL` :

```sql
create policy competence_select on competence for select
  using (site_id is null or site_id = public.current_site_id());
```

Les fonctions SQL existantes (`is_admin`, `has_role`, `can_edit_personne`,
`set_rotation_reference`, `creer_absence`, `maj_absence`) sont étoffées pour lire
`current_site_id()` et refuser toute action hors périmètre.

⚠️ **Le super_admin en impersonation** doit lire les données du site cible et non
son site d'origine. Deux options :
- **Option A** — impersonation côté application seulement : le super_admin
  s'authentifie via un compte technique local créé pour le site cible (surcouche
  UI). Simple, aucun changement RLS.
- **Option B** — `current_site_id()` regarde d'abord une claim JWT `impersonated_site`
  posée par une route serveur (`/platform/enter?site=…`) qui signe un token
  temporaire. Plus élégant, plus risqué (une fuite = accès cross-site).

Je recommande **A pour la V1** : la route `/platform/enter` crée à la volée un
`app_user` technique `support@polaris.support` rattaché au site, signe une session
Supabase pour ce compte, pose un bandeau permanent « MODE SUPPORT — retour ». Aucun
changement RLS, journalisation triviale sur `audit_impersonation`.

## 4. URL, sous-domaines et branding

### 4.1 DNS et Vercel

- Un seul projet Vercel `polaris`, un domaine racine `polaris.app`.
- Wildcard DNS `*.polaris.app` → Vercel (config unique).
- Vercel accepte les wildcards sur les domaines vérifiés. Chaque nouveau site
  n'implique **aucune** action DNS : le middleware résout le `slug` à la volée.

### 4.2 Middleware Next

`src/proxy.ts` (aujourd'hui minimaliste) devient :

```ts
// pseudo-code
const host = req.headers.get('host') ?? '';
const slug = host.split('.')[0];

if (slug === 'platform') {
  // routing spécifique super_admin
  return handlePlatform(req);
}

if (slug === 'www' || slug === '') {
  // landing publique
  return handleLanding(req);
}

const site = await siteBySlug(slug);
if (!site || site.statut === 'archive') return NextResponse.redirect('https://polaris.app/introuvable');
if (site.statut === 'suspendu' && !isPublicPath(req)) return NextResponse.redirect('https://polaris.app/suspendu');

const h = new Headers(req.headers);
h.set('x-site-id', site.id);
h.set('x-site-slug', site.slug);
h.set('x-site-nom', site.nom);
return NextResponse.next({ request: { headers: h } });
```

`getCurrentSite()` lit `x-site-id` (server components et server actions).
Les routes API (`src/app/api/**`) reçoivent le header et le posent dans une
helper `siteContext(request)`.

### 4.3 Cookies et auth Supabase

- **Ne jamais poser de cookie sur `.polaris.app`** (parent domain). Tous les
  cookies Supabase Auth doivent rester scopés au sous-domaine
  (`domain=usine-a.polaris.app`). C'est le comportement par défaut du client
  `@supabase/ssr` — à vérifier explicitement dans la config.
- Conséquence : login séparé par site. Un utilisateur logué sur A qui navigue
  vers B n'a **aucune session** sur B. Comportement voulu.

### 4.4 TV publique

`usine-a.polaris.app/affichage/atelier/[atelier]` reste **public** (pas d'auth,
comme aujourd'hui) mais le middleware garantit qu'un `atelier` inconnu du site A
renvoie 404. Une usine B ne peut pas afficher les ateliers d'A même en devinant
l'URL — le middleware coupe avant.

### 4.5 Branding

- `AppHeader` affiche `site.nom` à côté du logo. Aucun logo par site en V1
  (colonne prête, écran de config en V2).
- Le PDF de placement (`PlacementBoard.export`) intègre `site.nom` en pied de
  page — évite qu'une feuille imprimée d'une usine soit confondue avec l'autre.
- La bannière TV affiche `site.nom` en haut à droite (constant).
- **Aucune** duplication de contenu du guide utilisateur par site : un seul
  `public/guide.html` pour tout le monde. Si un site veut le sien, on branchera
  une variante par slug plus tard.

## 5. Super_admin et back-office `/platform`

- Sous-domaine dédié : `platform.polaris.app`, accessible uniquement aux comptes
  `app_user.est_super_admin = true`. Le middleware refuse toute autre session.
- Écrans V1 :
  - **Liste des sites** : nom, slug, statut, date de création, nb d'utilisateurs,
    nb de personnes.
  - **Créer un site** : slug (validé + blacklist), nom, création + copie des
    référentiels partagés + création du 1er compte admin local (avec lien de
    mot de passe généré à recopier).
  - **Suspendre / réactiver / archiver** un site (voir §7).
  - **Impersonation** : bouton « Entrer dans le site » qui redirige vers
    `slug.polaris.app`, avec le mode support activé + bandeau permanent.
  - **Journal d'impersonation** : table `audit_impersonation` (super_admin_id,
    site_id, entered_at, exited_at, ip, actions POST/PUT/DELETE effectuées).
- Écrans reportés en V2 : compteurs de facturation, quotas, matrice groupe
  éditable, catalogue partagé (compétences / motifs / contrats / rôles) —
  éditables via SQL en V1 par toi (fréquence faible).

⚠️ Le super_admin ne doit **jamais** apparaître comme rôle assignable dans
l'écran `/admin/users` d'un site. `getAllRoles()` filtre ; les gardes
d'anti-escalade traitent `est_super_admin` séparément.

## 6. Ossature applicative — impacts

### 6.1 Refdata et cache

`src/lib/refdata.ts` — la clé de cache passe de `['refdata']` à
`['refdata', siteId]`. Aucun cache global (sinon on affiche du site A à un utilisateur
du site B). Test : ajouter un test qui échoue si un `unstable_cache(...)` sans
`siteId` réapparaît dans le socle.

### 6.2 Fetch-all et écritures

`src/lib/fetch-all.ts` reste tel quel — c'est un utilitaire d'agrégation, il ne
touche pas au site. En revanche, **tout** appel qui construit une requête doit
poser `.eq('site_id', siteId)` **explicitement** en plus de la RLS. Deux raisons :
- Le planner Postgres utilise cet indice pour toucher directement les partitions /
  index composites `(site_id, ...)`.
- Défense en profondeur : si un jour une RLS est fausse, l'app ne fuit pas les
  autres sites.

Un test `Grep` sur le code : toute `supabase.from('table_metier')` sans
`.eq('site_id', ...)` fait échouer le test (whitelist explicite pour les rares
cas légitimes : liste des sites, refdata partagée…).

### 6.3 Server actions et gardes

- `requireModuleWrite(mod)` devient `requireModuleWrite(mod, siteId?)` — le
  paramètre est déduit du contexte quand il n'est pas fourni.
- `getServerClient()` et `getAdminClient()` restent, mais on ajoute :
  `getSiteScopedClient(siteId)` qui pose un GUC PostgreSQL
  (`set_config('app.site_id', siteId, true)`) que les helpers RLS lisent pour
  imposer une seconde couche de filtrage. Utile surtout pour `getAdminClient()`,
  qui bypasse la RLS aujourd'hui : en multi-tenant, c'est **impensable**
  d'appeler l'admin client sans borner explicitement le site.

### 6.4 Fonctions métier « site-aware »

- `src/lib/quarts.ts` — la liste des quarts est lue depuis le refdata site. Le
  quart par défaut reste `matin` s'il existe, sinon le premier dans l'ordre du
  site. Aucun code de quart en dur, comme aujourd'hui (test existant conservé).
- `src/lib/rotation.ts` — la référence datée devient `(site_id, semaine_lundi)`.
  `set_rotation_reference(site_id, ...)` posé en SQL.
- `src/lib/semaine-type.ts` — pareil, `(site_id, ...)`.
- `src/lib/parametres.ts` — les paramètres (fenêtre TV, autres) deviennent
  `parametre(site_id, cle, valeur)`. La route `/api/param-affichage` prend le
  `site_id` du contexte.
- `src/lib/habilitations.ts` — la logique reste ; seule la source de compétences
  passe par la vue partagée. `personne_competence` reste site-scopé.

### 6.5 Journalisation

Toutes les tables `journal_*` ajoutent `site_id`. Le super_admin en impersonation
inscrit son identifiant réel en plus, dans une colonne `impersonated_by`.

## 7. Cycle de vie d'un site

- **Création** — via `/platform`. Copie synchrone des référentiels partagés
  (motifs, contrats, compétences groupe, rôles groupe). Création du 1er compte
  admin local avec `LienMotDePasse` (§ `src/lib/password-link.ts`) — l'URL générée
  utilise **le sous-domaine du site** (`https://slug.polaris.app/reset?…`) et non
  la racine.
- **Suspension** — `site.statut = 'suspendu'`. Middleware refuse toute route
  hors `/suspendu`. Aucune donnée modifiée. Réactivation instantanée.
- **Archivage** — `site.statut = 'archive'`. Login impossible même pour le
  super_admin ; seul `/platform` peut consulter les données via une vue en lecture
  seule (script SQL, pas d'UI en V1). Cas d'usage : fin de contrat, données
  conservées pour audit RGPD.
- **Purge** — opération manuelle : script Node
  (`scripts/purger-site.ts <slug> --confirm`) qui supprime en cascade dans un
  ordre déterministe. Aucun bouton dans l'UI (une purge accidentelle est
  irréversible). Log complet.
- **RGPD** — quand un site le demande, la purge est réalisée sous 30 jours (délai
  légal moyen) + un e-mail de confirmation. En V1 tout est manuel, en V2 on
  automatise si on prend des clients externes.

## 8. Migration `0043` — plan détaillé

### 8.1 Contexte

- La base actuelle vit sur le projet Supabase `stcxlsmmnplxpirrnefm`.
- Dernière migration : `0042`.
- Migration `0043` = **big-bang multi-site** (choix arrêté).

### 8.2 Étapes SQL, dans l'ordre

1. **Créer `site`** et insérer le site historique :
   ```sql
   insert into site (id, slug, nom) values ('...uuid...', 'poulehen', 'Usine Poulehen');
   ```
   Le UUID est capturé dans une variable, ou on utilise un `slug` unique pour
   le référencer dans les DEFAULT.
2. **Ajouter `site_id` avec DEFAULT** sur toutes les tables métier :
   ```sql
   alter table personne add column site_id uuid not null
     default '...uuid site historique...' references site(id);
   ```
   Le `DEFAULT` évite de scanner deux fois (une pour la valeur, une pour NOT NULL).
   Après backfill implicite, on retire le DEFAULT si on veut forcer l'app à le
   fournir. En V1 on le garde pour ne pas casser d'écritures qui l'oublieraient
   (mais la RLS filtre déjà).
3. **Recréer les unicités** en `(site_id, ...)` — drop puis create.
4. **Ajouter les composite FK** sur les tables sensibles (§3.4).
5. **Ajouter `site_id` (nullable)** sur les tables partagées : `competence`,
   `motif_absence`, `type_contrat`, `role_custom`, `role_permission`. NULL =
   groupe. Toutes les lignes actuelles restent NULL (elles servent au site
   historique et à tout site futur).
6. **Réécrire les policies RLS** en une seule migration (drop + create). Utiliser
   la fonction `current_site_id()` définie à l'étape suivante.
7. **Créer les fonctions helpers** :
   ```sql
   create function current_site_id() returns uuid …;
   create function is_super_admin() returns boolean …;
   ```
8. **Journal** — ajouter `site_id` aux tables `journal_*`, backfiller au site
   historique.
9. **Ajout du champ `app_user.est_super_admin`** + backfill `false`. Ton compte
   passe à `true` via un `UPDATE` séparé qu'on te fera exécuter à la main (jamais
   dans une migration commitée).

### 8.3 Étapes applicatives (même PR)

- `src/proxy.ts` — résolution du sous-domaine et pose des headers.
- `src/lib/current-site.ts` — nouvelle helper `getCurrentSite()`.
- `src/lib/refdata.ts` — clé de cache `[..., siteId]`.
- `src/lib/permissions.ts` — signature de `requireModuleWrite` prend `siteId`
  optionnel.
- `src/lib/roles-server.ts` — `getAllRoles()` fusionne rôles intégrés + rôles
  groupe + rôles locaux au site courant.
- Toutes les routes API — poser `.eq('site_id', siteId)` sur chaque `from(...)`
  métier.
- Nouveau test statique `routes-multi-site.test.ts` — échoue si une route API
  écrit une table site-scopée sans `.eq('site_id', ...)`.
- `src/lib/password-link.ts` — l'URL passe par le sous-domaine de l'utilisateur
  cible (déduit de son `app_user.site_id`).

### 8.4 Downtime

- Le SQL de `0043` est destructif sur les policies : il faut basculer l'app et
  la base en même temps.
- Estimation : fenêtre de 5–10 min. Séquence :
  1. Déployer la nouvelle app sur Vercel en preview (branche `multi-site`).
  2. Passer la variable `MAINTENANCE=1` sur l'app prod (bannière « maintenance »
     ajoutée pour l'occasion).
  3. Exécuter `0043` via le SQL Editor Supabase.
  4. Promouvoir la preview `multi-site` en prod.
  5. Retirer `MAINTENANCE=1`.
- Pas de rollback simple : `0043` est irréversible en pratique. Sauvegarde
  Supabase (`pg_dump`) prise juste avant, garde-fou.

### 8.5 Vérification post-migration

- Le site `poulehen` est joignable sur `poulehen.polaris.app` avec les mêmes
  données qu'avant.
- Tests Vitest passent tous (189 + les nouveaux).
- Un site témoin `demo.polaris.app` créé, avec référentiels vides sauf ceux
  partagés. Login avec un compte demo, aucune donnée de Poulehen visible. Test
  manuel obligatoire.

## 9. Tests à ajouter

- `sites.test.ts` — validation des slugs (regex + blacklist), création d'un
  site copie bien les référentiels partagés.
- `routes-multi-site.test.ts` — statique : toute route API écrivant une table
  site-scopée pose un filtre `.eq('site_id', …)`.
- `refdata-cache.test.ts` — statique : tout `unstable_cache` porte `siteId` dans
  sa clé.
- `impersonation.test.ts` — la session support pose bien un bandeau, journalise
  l'entrée et la sortie, refuse `est_super_admin=false`.
- `permissions.test.ts` — étendu : un droit sur le site A n'ouvre rien sur B, un
  chef d'équipe ne peut pas modifier une personne d'un autre site (test qui
  existerait déjà si la personne était dans une autre équipe — on ajoute la
  variante site).
- `escalade.test.ts` — l'anti-escalade se calcule dans le périmètre du site.
- `rls-cross-site.test.ts` — intégration Supabase : deux sites, deux comptes,
  chaque `select * from …` ne rend que les lignes du site courant.

Cible : rester au-dessus de 200 tests à la fin du chantier.

## 10. Points ouverts pour la V2

- **Reporting groupe** — vue matérialisée
  `mv_bilans_groupe(site_id, semaine, ...)` rafraîchie chaque nuit, un rôle
  `codir_groupe` avec RLS spéciale (lecture sur toutes les lignes de la vue).
- **Facturation** — Stripe + `site.plan` + `site.quota_*` + webhook qui bascule
  `site.statut` en cas d'impayé.
- **Domaines personnalisés** — client qui veut `planning.usine-x.fr` : intégration
  Vercel « Custom Domains via API » + validation TXT.
- **SMTP par site** — sortie du modèle « mot de passe par lien » vers de vrais
  e-mails, potentiellement via un SMTP provisionné par site.
- **Import Excel** — assistant d'onboarding pour usines qui partent d'une matrice
  Excel existante.

## 11. Risques et pièges déjà identifiés

- **Fuite RLS** — une policy oubliée, un `getAdminClient()` sans borne, un
  `unstable_cache` sans `siteId` → toutes les données d'un autre site exposées.
  Défense en profondeur : `.eq('site_id', siteId)` **partout**, tests statiques,
  `getSiteScopedClient(siteId)` par défaut, `getAdminClient()` traqué par un test.
- **Cookies partagés** — un cookie posé sur `.polaris.app` casse toute
  l'isolation. Ne jamais poser de cookie sans `Domain` explicite (sous-domaine).
- **Impersonation abusive** — le journal `audit_impersonation` doit être visible
  par le super_admin cible **et** exportable ; à défaut, il perd sa valeur
  dissuasive.
- **Performance des jointures** — les composite FKs (§3.4) ajoutent des index
  supplémentaires. À surveiller sur `placement` (~grosse table, écritures
  fréquentes).
- **Backfill des tables partagées** — un motif d'absence marqué NULL/site aujourd'hui
  peut soudain devenir invisible à un nouveau site (parce qu'il n'aura pas été
  copié). Décision : à la création d'un site, tous les motifs NULL sont
  **visibles automatiquement** (via la vue partagée), rien à copier.
- **Migration irréversible** — pas de retour arrière propre après `0043`. Le
  `pg_dump` avant migration est **obligatoire**.
- **Perf du bilan matrice** — déjà à la limite en mono-site (22 000 cellules).
  Le multi-site ne l'aggrave pas directement (chaque site ne voit que le sien),
  mais s'il devient nécessaire de faire du reporting groupe, la matérialisation
  est indispensable.

## 12. Séquence de livraison suggérée

1. **PR 1 — Fondations** : `0043` (base + RLS), middleware, `getCurrentSite()`,
   `refdata` sitisé, `est_super_admin`. Le site historique tourne exactement
   comme avant, un test de non-régression passe intégralement.
2. **PR 2 — Écrans site** : ajout de `site.nom` dans l'entête et le PDF ; TV et
   affichage ok ; login refusé si `site.statut = 'suspendu'`.
3. **PR 3 — /platform et super_admin** : back-office minimal (lister, créer,
   suspendre un site) ; impersonation tracée.
4. **PR 4 — Onboarding** : création d'un site avec copie des référentiels
   partagés + génération du 1er lien mot de passe.
5. **PR 5 — Tests & durcissement** : `routes-multi-site.test.ts`, `rls-cross-site`,
   sanity checks sur `getAdminClient`. Deuxième site `demo` en prod, non
   commercialisé.
6. **PR 6+ — Fonctionnalités** : selon usage réel (bilans groupe, branding,
   quotas, Stripe).

**Effort estimé** — PR 1 à 5 : ~2 à 3 semaines à temps plein, l'essentiel étant
la migration et la revue systématique de chaque route API pour poser
`.eq('site_id', …)` et vérifier les RLS.
