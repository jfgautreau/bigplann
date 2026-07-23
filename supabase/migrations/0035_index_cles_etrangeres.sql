-- =====================================================================
-- Migration 0035 - Index sur les cles etrangeres de suppression en cascade
--
-- Postgres n'indexe PAS automatiquement le cote « enfant » d'une cle
-- etrangere. Sans index, chaque suppression (ou mise a jour) du parent
-- declenche un BALAYAGE COMPLET de la table enfant pour retrouver les
-- lignes a effacer ou a mettre a NULL.
--
-- Cas le plus couteux, et deja actif : `placement.absence_id`.
--   - supprimer une absence          -> cascade -> balayage de `placement`
--   - modifier une absence           -> /api/absence fait un
--     `delete().eq("absence_id", id)` avant de rematerialiser les jours,
--     donc un second balayage complet.
-- `placement` grossit d'environ 7 000 lignes par mois : le cout augmente
-- indefiniment, sans qu'aucune erreur ne le signale.
--
-- Ces index ne changent AUCUNE donnee et ne modifient aucun comportement :
-- ils ne font qu'eviter les balayages.
--
-- CONCURRENTLY n'est volontairement pas utilise : cet ordre ne peut pas
-- s'executer dans un bloc transactionnel, ce que le SQL Editor ne garantit
-- pas. Aux volumes actuels (~10^4-10^5 lignes) la creation est immediate.
--
-- A executer dans le SQL Editor APRES 0034_agence_interim.sql.
-- =====================================================================

-- 1. placement.absence_id : cascade depuis `absence` (le cas critique).
create index if not exists placement_absence_idx
  on public.placement (absence_id);

-- 2. placement.motif_absence_id : `on delete set null` depuis `motif_absence`.
--    Desactiver un motif ne coute rien, mais en SUPPRIMER un balaye la table.
create index if not exists placement_motif_idx
  on public.placement (motif_absence_id);

-- 3. placement.equipe_id : `on delete set null` depuis `equipe`.
create index if not exists placement_equipe_idx
  on public.placement (equipe_id);

-- 4. absence.motif_absence_id : `on delete set null` depuis `motif_absence`.
create index if not exists absence_motif_idx
  on public.absence (motif_absence_id);

-- 5. ouverture_quart.ligne_id : cascade depuis `ligne`. La cle primaire est
--    (jour, ligne_id, quart_code) — `ligne_id` n'y est PAS en tete, l'index
--    de cle primaire ne peut donc pas servir cette recherche. La table
--    depasse deja 700 lignes par mois d'ordonnancement.
create index if not exists ouverture_quart_ligne_idx
  on public.ouverture_quart (ligne_id);

-- Note : `equipe_chef.app_user_id` est dans le meme cas (cascade depuis
-- app_user, non indexee), mais la table compte une poignee de lignes —
-- un balayage y est gratuit. Volontairement laisse tel quel.
