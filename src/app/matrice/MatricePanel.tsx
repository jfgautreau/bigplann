"use client";

import { useState } from "react";
import MatriceFilters from "./MatriceFilters";
import MatrixGrid from "./MatrixGrid";
import LegendeModal from "./LegendeModal";

type Poste = { id: string; nom: string; objectifActuel?: number; objectifCible?: number };
type Group = { ligneId: string; ligneNom: string; postes: Poste[] };
type Personne = { id: string; label: string; editable: boolean };
type Cell = { a: number; c: number };
type Opt = { id: string; label: string };

export default function MatricePanel({
  groups,
  personnes,
  initial,
  canEditObjectif,
  ateliers,
  equipes,
  atelier,
  equipe,
  niveauLibelles,
}: {
  groups: Group[];
  personnes: Personne[];
  initial: Record<string, Cell>;
  canEditObjectif: boolean;
  ateliers: Opt[];
  equipes: Opt[];
  atelier: string;
  equipe: string;
  niveauLibelles: { niveau: number; libelle: string }[];
}) {
  const [mode, setMode] = useState<"actuel" | "cible">("actuel");
  const [showLegende, setShowLegende] = useState(false);

  return (
    <>
      {/* Gauche : filtres · Centre : mode · Droite : legende */}
      <div className="toolbar" style={{ alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
        <MatriceFilters ateliers={ateliers} equipes={equipes} atelier={atelier} equipe={equipe} />
        <div className="modeswitch">
          <button type="button" className={mode === "actuel" ? "on-actuel" : ""} onClick={() => setMode("actuel")}>
            Niveau actuel
          </button>
          <button type="button" className={mode === "cible" ? "on-cible" : ""} onClick={() => setMode("cible")}>
            Niveau cible
          </button>
        </div>
        <button type="button" className="btn-sm btn-ghost" style={{ width: "auto" }} onClick={() => setShowLegende(true)}>
          📖 Légende
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="muted">Aucun poste actif (vérifiez le référentiel / le filtre atelier).</p>
      ) : (
        <MatrixGrid groups={groups} personnes={personnes} initial={initial} canEditObjectif={canEditObjectif} mode={mode} />
      )}

      {showLegende && <LegendeModal niveauLibelles={niveauLibelles} onClose={() => setShowLegende(false)} />}
    </>
  );
}
