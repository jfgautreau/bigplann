-- =====================================================================
-- Migration 0038 - Nettoyage preparatoire : normalisation des placements
--                  historiques + suppression de trois tables mortes.
--
-- ⚠️ CETTE MIGRATION SUPPRIME DES TABLES. Elle est irreversible. Lire le
--    point 2 avant de l'executer.
--
-- A executer dans le SQL Editor APRES 0037.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. Placements historiques sans quart
--
-- La colonne `placement.quart_code` est arrivee en 0014 : les placements
-- anterieurs l'ont a NULL. L'application comblait ce vide a la lecture, mais
-- de DEUX facons contradictoires :
--   - /api/placement/cell, la copie de journee, l'affichage TV et le bilan de
--     couverture lisaient `quart_code ?? 'matin'` ;
--   - /planning lisait `quartCodes[0]`, soit 'journee' (ordre 0).
-- Les memes lignes apparaissaient donc sous deux quarts differents selon
-- l'ecran. Releve du 23/07/2026 : 7 placements SUR POSTE sont concernes.
--
-- On tranche dans la donnee plutot que dans le code : ces lignes prennent le
-- quart que la saisie leur attribuait a l'epoque ('matin' — 'journee' n'existait
-- pas avant la migration 0021).
--
-- ⚠️ On ne touche PAS aux placements sans poste (absence, jour non travaille) :
-- leur `quart_code` est NULL A DESSEIN, une absence valant pour toute la
-- journee, tous quarts confondus (cf. /api/placement/cell).
-- ------------------------------------------------------------------
update public.placement
   set quart_code = coalesce(
         (select code from public.quart where code = 'matin'),
         (select code from public.quart order by ordre limit 1)
       )
 where quart_code is null
   and poste_id is not null;

-- ------------------------------------------------------------------
-- 2. Tables mortes
--
-- Aucune lecture applicative ne les touche plus ; leur contenu est remplace,
-- ligne pour ligne, par des tables plus recentes :
--
--   equipe_quart_semaine (16 lignes) -> rotation_reference (migration 0030).
--       Ancienne saisie semaine par semaine du quart de chaque equipe.
--       Remplacee par les references datees, dont l'alternance est calculee.
--
--   ligne_ouverture (7 lignes)  -> ouverture_quart (migration 0013).
--   jour_equipe    (38 lignes)  -> jour_quart      (migration 0013).
--       Ouverture par equipe, remplacee par l'ouverture par QUART. Leur seul
--       ecrivain restant etait /api/ordonnancement/toggle, route sans aucun
--       appelant, supprimee a l'etape 2.
--
-- Interet du menage : sans lui, la refonte multi-sites devrait doter chacune de
-- ces tables d'un `site_id`, d'une cle etrangere composite et de deux
-- politiques RLS — environ un dixieme du travail SQL, pour du code que personne
-- n'execute.
--
-- ⚠️ Le contenu est perdu. Pour le conserver, executer AVANT :
--     create table archive_equipe_quart_semaine as table public.equipe_quart_semaine;
--     create table archive_ligne_ouverture      as table public.ligne_ouverture;
--     create table archive_jour_equipe          as table public.jour_equipe;
-- ------------------------------------------------------------------
drop table if exists public.equipe_quart_semaine;
drop table if exists public.ligne_ouverture;
drop table if exists public.jour_equipe;

-- ------------------------------------------------------------------
-- 3. `poste.est_conducteur` : NON supprime, volontairement
--
-- La colonne est depreciee depuis la 0021, qui l'a remplacee par
-- `poste.categorie` (manager / conducteur / operateur). Elle n'est plus
-- maintenue et diverge : au 23/07/2026, 9 postes ont `categorie='conducteur'`
-- et `est_conducteur=false`.
--
-- Toutes ses lectures applicatives ont ete retirees par cette meme livraison.
-- La colonne, elle, reste : la supprimer est irreversible et n'apporte rien de
-- mesurable, alors que retirer ses lectures suffit a garantir qu'aucun ecran ne
-- s'appuie sur une donnee fausse. Candidate a la suppression lors de la refonte
-- multi-sites, ou chaque colonne devra de toute facon etre revue.
-- ------------------------------------------------------------------
