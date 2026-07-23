-- =====================================================================
-- Migration 0039 - Départ prévu d'une personne
--
-- L'écran Personnel affichait une colonne « Fin contrat », remplacée par un
-- suivi des absences. Reste un besoin que la fin de contrat ne couvrait pas :
-- annoncer qu'une personne VA quitter l'effectif (retraite, démission, fin de
-- mission), et à quelle date.
--
-- Pourquoi ne pas réutiliser `personne.date_fin` :
--   - elle est le REFLET de la période de contrat la plus récente, réécrite
--     automatiquement à chaque modification des contrats (cf. /api/personnel) ;
--     une saisie manuelle y serait écrasée sans prévenir ;
--   - un départ n'est pas une fin de contrat : un CDI qui part à la retraite
--     n'a aucune date de fin de contrat.
--
-- `statut` n'est PAS modifié automatiquement à cette date : aucune tâche
-- planifiée ne tourne sur ce projet, et basculer quelqu'un en « Parti » sans
-- action humaine le ferait disparaître du planning en silence. L'écran signale
-- l'échéance (badge orange avant, rouge une fois dépassée) ; la bascule reste
-- un geste explicite.
--
-- A executer dans le SQL Editor APRES 0038.
-- =====================================================================

alter table public.personne
  add column if not exists date_depart_prevu date,
  add column if not exists motif_depart      text;

comment on column public.personne.date_depart_prevu is
  'Date a laquelle la personne doit quitter l''effectif. Informatif : ne bascule pas `statut` automatiquement.';
comment on column public.personne.motif_depart is
  'Motif du depart prevu (retraite, demission, fin de mission...). Texte libre.';

-- Les personnes encore actives dont le depart est deja passe : c'est ce que
-- l'ecran met en evidence pour appeler la desactivation.
create index if not exists personne_depart_prevu_idx
  on public.personne (date_depart_prevu)
  where date_depart_prevu is not null;
