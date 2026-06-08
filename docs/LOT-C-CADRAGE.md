# Cahier des charges — Lot C (changements structurels)

> Décisions validées avec l'utilisateur le 2026-06-08. Sert de référence pour
> l'implémentation. Migration associée : `supabase/migrations/0021_lotc.sql`.

## 1. Quart « journée » (équipe régulière fixe)

- **Nouveau quart** `journee` (libellé « Journée », `ordre = 0` donc en tête), horaires
  par défaut 08:00–16:00 (les vrais horaires se saisissent au poste, cf. §5).
- **Équipe fixe** : nouvelle colonne `equipe.quart_fixe` (code de quart, NULL = tourne
  normalement). Réglée **une seule fois** dans Admin → Équipes.
  - Si `quart_fixe` est défini : l'équipe ne tourne pas, le planning la met d'office sur
    ce quart, et elle est exclue de l'écran Rotation.
  - L'équipe « journée » aura `quart_fixe = 'journee'`.
- Le sélecteur de quart du planning liste désormais Journée + Matin + Aprem + Nuit.

## 2. Activation poste × quart

- **Nouvelle table** `poste_quart (poste_id, quart_code, actif)`. **Défaut = actif** :
  une ligne n'existe que pour **désactiver** un couple (poste, quart). Aucun seed requis.
- **Référentiel** : matrice de cases à cocher par poste, une colonne par quart. Tout coché
  par défaut ; décocher écrit `actif = false`.
- **Effet planning** : pour le quart affiché, seuls les postes **activés pour ce quart**
  sont proposés dans les `<select>` et comptés dans le besoin. **Se cumule** avec
  l'ouverture quotidienne de l'ordonnancement (`ouverture_quart`) : il faut poste actif
  sur le quart ET ligne ouverte ce jour-là.

## 3. Catégorie de poste : Manager / Conducteur / Opérateur

- **Nouvelle colonne** `poste.categorie` ∈ {`manager`, `conducteur`, `operateur`},
  défaut `operateur`. « Manager » = formalisation de l'actuel « Chef d'équipe ».
- **Reprise depuis l'existant** (migration) :
  - `est_conducteur = true` → `conducteur` ;
  - sinon, ligne nommée `CE` ou poste contenant `chef`/`CE` → `manager` ;
  - sinon → `operateur`.
- **Référentiel** : la colonne « Conduc. » (case à cocher) devient un `<select>`
  Catégorie (Manager / Conducteur / Opérateur).
- `est_conducteur` est conservé en base pour ne rien casser, mais n'est plus la source de
  vérité (les lectures basculent sur `categorie`).

## 4. Bilans en tête du planning

- **3 lignes** ajoutées au bloc d'indicateurs (à côté de Besoin / Présent / Delta) :
  **Managers**, **Conducteurs**, **Opérateurs**, format « présents/requis » par jour, pour
  le **quart affiché**, colorées en rouge si présents < requis.
  - **Requis** = somme des `effectif_requis` des postes de la catégorie, sur les lignes
    ouvertes ce jour-là et actives sur le quart affiché.
  - **Présents** = personnes placées sur un poste de la catégorie ce jour-là (quart affiché).
- **Bilan « Compétences disponibles »** : remplace l'heuristique de détection par nom
  (`catOf`) par `poste.categorie`. Libellés alignés (Managers / Conducteurs / Opérateurs).
- **Affichage TV** : bascule les lectures `est_conducteur` sur `categorie`.

## 5. Horaires standards vs spécifiques

- **Standard** = `horaire_poste` (poste × quart × jour), inchangé : le gabarit hebdo.
- **Spécifique** = **nouvelle table** `horaire_exception (personne_id, jour, debut, fin,
  motif?)`, unique sur (personne_id, jour). Déclenché au besoin, à la personne et à la
  date. **Motif optionnel.**
- **Résolution de l'horaire effectif** (planning + écrans TV) : pour une personne un jour
  donné = **exception** si elle existe, **sinon** horaire standard du `poste × quart × jour`
  où elle est placée. Pas de duplication : surcharge ponctuelle.
- **Saisie** : (a) **depuis la case du planning** (action sur la cellule d'une personne →
  petit éditeur début/fin/motif pour ce jour) ; (b) **écran dédié** pour la gestion en masse.
- **Droits** : mêmes que le placement (`can_edit_personne` : admin ou chef de l'équipe).

## Séquencement d'implémentation

1. **Migration 0021** (schéma ci-dessus) — à appliquer par l'utilisateur.
2. **Référentiel** : catégorie + matrice poste×quart.
3. **Équipes / Rotation / Planning** : quart fixe, quart journée dans les sélecteurs,
   exclusion rotation, auto-sélection du quart pour une équipe fixe.
4. **Planning** : filtre poste×quart + 3 bilans de catégorie.
5. **Bilan Compétences + Affichage TV** : bascule sur `categorie`.
6. **Horaires spécifiques** : écran dédié + saisie depuis la case + résolution d'affichage.
