-- 0052 : Périodes de temps partiel
--
-- Remplacement du champ unique personne.tp_config par une table de périodes
-- datées, permettant l'anticipation de changements de rythme et la
-- consultation de l'historique.
--
-- Règles de verrouillage (appliquées côté application) :
--   - Période passée (date_fin < today) : lecture seule
--   - Période courante (date_debut ≤ today ≤ date_fin ou date_fin IS NULL) :
--     on peut modifier date_fin et tp_config, mais pas date_debut
--   - Période future (date_debut > today) : entièrement modifiable, supprimable
--
-- Un gap entre deux périodes signifie que la personne est à temps plein.
-- date_fin NULL = période ouverte (pas de fin prévue).

CREATE TABLE tp_periode (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  personne_id uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  date_debut  date NOT NULL,
  date_fin    date,                           -- NULL = pas de fin prévue
  tp_config   jsonb NOT NULL DEFAULT '{}',    -- même structure que personne.tp_config
  created_at  timestamptz DEFAULT now(),

  CONSTRAINT tp_periode_dates_check CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

-- Index pour les requêtes courantes.
CREATE INDEX idx_tp_periode_personne ON tp_periode(personne_id);
CREATE INDEX idx_tp_periode_dates    ON tp_periode(personne_id, date_debut, date_fin);

-- RLS : mêmes règles que personne (admin ou chef de l'équipe).
ALTER TABLE tp_periode ENABLE ROW LEVEL SECURITY;

CREATE POLICY tp_periode_select ON tp_periode
  FOR SELECT USING (true);

CREATE POLICY tp_periode_insert ON tp_periode
  FOR INSERT WITH CHECK (can_edit_personne(personne_id));

CREATE POLICY tp_periode_update ON tp_periode
  FOR UPDATE USING (can_edit_personne(personne_id));

CREATE POLICY tp_periode_delete ON tp_periode
  FOR DELETE USING (can_edit_personne(personne_id));

-- Migration des données existantes : pour chaque personne ayant
-- temps_partiel = true et un tp_config non vide, créer une période
-- ouverte (sans date de fin) démarrant aujourd'hui.
INSERT INTO tp_periode (personne_id, date_debut, date_fin, tp_config)
SELECT id, CURRENT_DATE, NULL, tp_config
FROM personne
WHERE temps_partiel = true
  AND tp_config IS NOT NULL
  AND tp_config != '{}'::jsonb;

-- Note : les colonnes personne.temps_partiel et personne.tp_config sont
-- conservées pour l'instant (rétro-compatibilité). Elles seront
-- supprimées dans une migration ultérieure une fois que tout le code
-- applicatif utilisera tp_periode.
