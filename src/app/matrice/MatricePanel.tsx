"use client";

import { useState } from "react";
import AtelierEquipeFiltres from "@/components/AtelierEquipeFiltres";
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
      {/* Gauche : filtres · Droite : bascule Actuel / Cible (meme ligne). */}
      <div className="headband">
      <div className="toolbar" style={{ alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
        <AtelierEquipeFiltres base="/matrice" ateliers={ateliers} equipes={equipes} atelier={atelier} equipe={equipe} />
        <button
          type="button"
          role="switch"
          aria-checked={mode === "cible"}
          onClick={() => setMode((m) => (m === "actuel" ? "cible" : "actuel"))}
          title="Basculer entre niveau actuel et niveau cible"
          style={{ position: "relative", width: 156, height: 28, flex: "0 0 auto", margin: 0, padding: 0, border: "1px solid var(--border)", borderRadius: 999, background: "#eef2f7", cursor: "pointer", display: "flex" }}
        >
          <span style={{ position: "absolute", top: 2, bottom: 2, width: "calc(50% - 3px)", left: mode === "actuel" ? 3 : "auto", right: mode === "cible" ? 3 : "auto", borderRadius: 999, background: mode === "actuel" ? "#1d4ed8" : "#16a34a", transition: "left 0.18s ease, right 0.18s ease" }} />
          <span style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: mode === "actuel" ? "#fff" : "#64748b" }}>Actuel</span>
          <span style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: mode === "cible" ? "#fff" : "#64748b" }}>Cible</span>
        </button>
      </div>
      </div>

      <div className="gridband">
        {groups.length === 0 ? (
          <p className="muted">Aucun poste actif (vérifiez le référentiel / le filtre atelier).</p>
        ) : (
          <MatrixGrid groups={groups} personnes={personnes} initial={initial} canEditObjectif={canEditObjectif} mode={mode} onShowLegende={() => setShowLegende(true)} />
        )}
      </div>

      {showLegende && <LegendeModal niveauLibelles={niveauLibelles} onClose={() => setShowLegende(false)} />}
    </>
  );
}
