"use client";

import { useState } from "react";
import MatriceFilters from "./MatriceFilters";
import MatrixGrid from "./MatrixGrid";

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
}: {
  groups: Group[];
  personnes: Personne[];
  initial: Record<string, Cell>;
  canEditObjectif: boolean;
  ateliers: Opt[];
  equipes: Opt[];
  atelier: string;
  equipe: string;
}) {
  const [mode, setMode] = useState<"actuel" | "cible">("actuel");

  return (
    <>
      {/* Filtres (gauche) + bascule Actuel/Cible (droite), meme ligne */}
      <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <MatriceFilters ateliers={ateliers} equipes={equipes} atelier={atelier} equipe={equipe} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="muted">Je saisis :</span>
          <div className="modeswitch">
            <button type="button" className={mode === "actuel" ? "on-actuel" : ""} onClick={() => setMode("actuel")}>
              Niveau actuel
            </button>
            <button type="button" className={mode === "cible" ? "on-cible" : ""} onClick={() => setMode("cible")}>
              Niveau cible
            </button>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="muted">Aucun poste actif (vérifiez le référentiel / le filtre atelier).</p>
      ) : (
        <>
          <p className="muted" style={{ margin: "-6px 0 10px", fontSize: 12, textAlign: "right" }}>
            Clic = +1 · clic droit = −1 · enregistrement automatique
          </p>
          <MatrixGrid groups={groups} personnes={personnes} initial={initial} canEditObjectif={canEditObjectif} mode={mode} />
        </>
      )}
    </>
  );
}
