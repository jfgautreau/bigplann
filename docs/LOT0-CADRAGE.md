# Lot 0 — Cadrage : modèle de données & sitemap

> Document de conception à valider **avant** de coder les modules métier.
> Stack : Next.js 16 (App Router) + Supabase (PostgreSQL + Auth + RLS) + Vercel.
> Tout est en français côté UI. Convention de nommage base : `snake_case`.

---

## 1. Principes transverses

- **`app_user`** = comptes de connexion (≈ 5-10 utilisateurs avec un rôle). Déjà en place.
- **`personne`** = les ≈150 opérateurs planifiés (la plupart **sans** compte de connexion). Entité distincte de `app_user`.
- **Lecture pour tous les rôles authentifiés** (RLS `select` ouvert aux `authenticated`).
- **Écriture restreinte par rôle et périmètre** via fonctions SQL `is_admin()`, `has_role(...)`, `is_chef_of_equipe(equipe_id)`.
- **Audit** : déclencheurs PostgreSQL sur les tables métier → `audit_log` (capture `auth.uid()`, anciennes/nouvelles valeurs en JSON).
- **Horodatage** : `created_at` / `updated_at` sur toutes les tables métier.

---

## 2. Modèle de données (diagramme texte)

### 2.1 Référentiel structurel
```
atelier(id, nom, actif, created_at, updated_at)
ligne(id, atelier_id→atelier, nom, actif, created_at, updated_at)
poste(id, ligne_id→ligne, nom,
      difficulte_formation int CHECK 1..3,
      niveau_min_requis int CHECK 0..4,
      actif, created_at, updated_at)

equipe(id, nom, actif, created_at, updated_at)            -- A, B, C, Nuit...
equipe_chef(equipe_id→equipe, app_user_id→app_user)       -- chefs désignés (N-N)
   PK(equipe_id, app_user_id)
```

### 2.2 Personnel
```
personne(id, matricule UNIQUE NULL,          -- auto-généré si intérimaire sans matricule
         nom, prenom,
         equipe_id→equipe,
         type_contrat ENUM('CDI','CDD','INTERIM'),
         agence_interim NULL,                 -- si INTERIM
         date_debut, date_fin NULL,           -- date_fin si CDD/INTERIM
         est_operateur bool DEFAULT true,     -- Opérateur vs ... (cf. Conducteur §3)
         commentaire text NULL,               -- PAS d'info médicale (note UI)
         statut ENUM('ACTIF','PARTI') DEFAULT 'ACTIF',
         anonymise bool DEFAULT false, anonymise_at NULL,  -- RGPD
         created_at, updated_at)
```

### 2.3 Matrice de polyvalence
```
competence_niveau_libelle(niveau int PK CHECK 0..4, libelle)   -- échelle paramétrable

matrice(id, personne_id→personne, poste_id→poste,
        niveau_actuel int CHECK 0..4 DEFAULT 0,
        niveau_cible  int CHECK 0..4 DEFAULT 0,
        est_conducteur bool DEFAULT false,    -- Conducteur = attribut (personne × poste)
        commentaire NULL,
        date_maj, auteur_app_user_id→app_user,
        created_at)
   UNIQUE(personne_id, poste_id)

-- Compétences transverses ET habilitations à recycler = même table (flag a_recycler)
competence(id, nom,
           type ENUM('NIVEAU','ACQUIS'),      -- niveau 0..4 OU acquis/non
           a_recycler bool DEFAULT false,     -- true => habilitation à durée de validité
           duree_validite_mois int NULL,      -- défaut si a_recycler
           actif, created_at, updated_at)      -- ex: Tuteur, EPI, Incendie, 5S, Élec...

personne_competence(id, personne_id→personne, competence_id→competence,
                    niveau int NULL CHECK 0..4,    -- si type NIVEAU
                    acquis bool NULL,              -- si type ACQUIS
                    date_obtention NULL,
                    date_expiration NULL,          -- calculée si a_recycler
                    auteur_app_user_id→app_user, date_maj, created_at)
   UNIQUE(personne_id, competence_id)
```

### 2.4 Absences & congés
```
motif_absence(id, libelle, code_court, couleur,
              decompte_cp bool, bloque_placement bool,
              actif, created_at, updated_at)
   -- seed: CP, CP Anc, Congé en attente, AM, RCR, ACR, Récup nuit, REPA, JNT,
   --       ABNI, Arrêt 1j/2j/1sem, Fin de contrat, Formation

absence(id, personne_id→personne, motif_id→motif_absence,
        date_debut, date_fin,
        statut ENUM('EN_ATTENTE','VALIDE','REFUSE') DEFAULT 'VALIDE',
              -- 'EN_ATTENTE' surtout pour les congés (workflow §9.4)
        demandeur_app_user_id→app_user,
        valideur_app_user_id NULL, date_validation NULL, raison_refus NULL,
        created_at, updated_at)

cp_solde(id, personne_id→personne, annee int, jours_initiaux numeric,
         created_at, updated_at)
   UNIQUE(personne_id, annee)
   -- jours consommés = somme des absences CP validées de l'année (calculé)
```

### 2.5 Planning
```
jour_equipe(date, equipe_id→equipe, actif bool)   -- activer/désactiver nuit par jour
   PK(date, equipe_id)
ligne_ouverture(date, ligne_id→ligne, ouverte bool)  -- lignes ouvertes/fermées du jour
   PK(date, ligne_id)
besoin_poste(date, poste_id→poste, nb_requis int)    -- besoin chiffré (indicateurs §7.5)
   PK(date, poste_id)

placement(id, date, personne_id→personne, equipe_id→equipe,
          poste_id→poste NULL,             -- poste assigné...
          motif_absence_id NULL,           -- ...OU motif d'absence du jour
          non_travaille bool DEFAULT false,-- OU jour non travaillé (X)
          created_by→app_user, created_at, updated_at)
   UNIQUE(personne_id, date)               -- 1 personne = 1 ligne / jour
   INDEX(date), INDEX(poste_id, date), INDEX(personne_id, date)
   -- volumétrie cible ≈ 280k lignes/an
```

### 2.6 Traçabilité, notifications, paramètres
```
audit_log(id, app_user_id NULL, action ENUM('INSERT','UPDATE','DELETE'),
          table_name, record_id, old_values jsonb, new_values jsonb, created_at)
   -- alimenté par triggers ; conservation 3 ans puis purge

notification(id, destinataire_app_user_id→app_user, type, message, lien NULL,
             lu bool DEFAULT false, created_at)
   -- habilitation à 90/30/0 j, congé en attente, sous-effectif, placement hab expirée

app_setting(cle PK, valeur jsonb, updated_at)
   -- divers : format PDF (A3/A4), plages IP affichage couloir, durée session...
```

---

## 3. Décisions à confirmer (anciennes ambiguïtés)

| # | Sujet | Proposition retenue dans ce modèle | À confirmer |
|---|-------|-----------------------------------|-------------|
| A | Login | Email (Supabase Auth) pour les `app_user`. Matricule = identifiant des `personne`. | ✅ par défaut |
| C | Conducteur | Attribut **booléen par (personne × poste)** dans `matrice` (proposition du cahier §7.6). Couleur saumon au placement. | ⚠️ à valider |
| E | Transverses vs habilitations | **Une seule table `competence`** avec flag `a_recycler` + `duree_validite_mois`. Une habilitation = compétence à recycler. | ⚠️ à valider |
| F | Granularité du besoin | `ligne_ouverture` (ouverte/fermée) **+** `besoin_poste` (nombre requis par poste/jour) **+** `jour_equipe` (nuit on/off). Couvre §7.3 et les indicateurs §7.5. | ⚠️ à valider |
| G | Export Excel de référence | Besoin d'un **vrai fichier** (matrice + planning) pour caler le template d'import et les couleurs. | ⚠️ fournir si dispo |

### Conséquence du changement de stack (Vercel, plus de reverse-proxy)
- **Affichage couloir (§8.4)** : le filtrage IP devait se faire au reverse-proxy Caddy. Sur Vercel il n'y en a pas. Options :
  1. **Allowlist IP dans `proxy.ts`** (plage interne lue depuis `app_setting`/env) — simple, mais l'IP vue par Vercel est l'IP publique de sortie de l'usine (à récupérer), pas les IP internes.
  2. **Vercel Firewall** (règles IP au niveau plateforme).
  3. **URL à jeton secret** (`/affichage/atelier/X?k=...`) sans login.
  > ⚠️ Décision à prendre. Recommandation : **option 1 ou 3** (l'IP publique de sortie de l'usine en allowlist, ou un jeton), à câbler au Lot « Affichage couloir ».

---

## 4. Sitemap fonctionnel (écrans)

### Public / authentification
- `/login`, `/forgot`, `/reset`, `/auth/callback` ✅ (faits)
- `/affichage/atelier/[atelier]` — **kiosque public**, plein écran, refresh 60 s, + bouton PDF

### Application (authentifié) — en-tête commun avec cloche 🔔 notifications
- `/` — **Accueil** (selon rôle ; KPIs du jour en V2)
- **Personnel**
  - `/personnel` — liste + filtres + import/export Excel (Admin/RH)
  - `/personnel/[id]` — fiche (contrat, solde CP, compétences)
- **Matrice**
  - `/matrice` — saisie niveaux actuel/cible (chef = son équipe)
  - `/matrice/bilan` — Besoin / Existant / Écart par poste & niveau
- **Habilitations / compétences**
  - `/habilitations` — tableau « à recycler » trié par échéance (vert/orange/rouge)
- **Planning**
  - `/ordonnancement` — saisie besoins : lignes ouvertes, nuit on/off, nb requis
  - `/planning` — vue hebdo (personnes × jours) + indicateurs Besoin/Présent/Delta/Alertes
  - `/planning/jour` — vue par poste (alternative)
- **Absences & congés**
  - `/absences` — saisie (chef = son équipe)
  - `/conges` — file des congés **en attente** à valider (Resp. prod / planning)
- **Bilans**
  - `/bilans` — effectifs, polyvalence, écarts compétences, habilitations (impression soignée)
- **Journal**
  - `/journal` — audit (Admin, Resp. prod)
- **Administration**
  - `/admin/users` ✅ — comptes & rôles
  - `/admin/referentiel` — ateliers / lignes / postes (CRUD + désactivation)
  - `/admin/equipes` — équipes & chefs
  - `/admin/motifs` — motifs d'absence
  - `/admin/competences` — compétences/habilitations + échelle de niveaux
  - `/admin/parametres` — divers (PDF, session, IP couloir...)
  - `/admin/rgpd` — export / suppression / anonymisation d'une personne
  - `/admin/registre` — registre des traitements (RGPD)

---

## 5. Découpage des lots suivants (rappel, adapté à la stack)
- **Lot 2** Référentiel (atelier/ligne/poste, équipes, personnel + import/export) + audit
- **Lot 3** Matrice + bilan
- **Lot 4** Habilitations + alertes + notifications
- **Lot 5** Planning (besoins, placement, indicateurs, alertes)
- **Lot 6** Absences + solde CP + workflow congé
- **Lot 7** Affichage couloir + PDF + restriction d'accès
- **Lot 8** Bilans
- **Lot 9** RGPD + doc + tests règles métier
