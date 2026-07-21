"use client";

import { useState } from "react";
import AtelierEquipeFiltres from "@/components/AtelierEquipeFiltres";
import SlideSwitch from "@/components/SlideSwitch";
import PageTitle from "@/components/PageTitle";
import Link from "next/link";
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
      {/* Bandeau unique : titre · filtres · bascule Actuel / Cible — meme
          structure que l'ecran Habilitations. */}
      <div className="headband headband-top">
      <div className="toolbar" style={{ alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
        <PageTitle module="matrice">Matrice de polyvalence</PageTitle>
        <AtelierEquipeFiltres base="/matrice" ateliers={ateliers} equipes={equipes} atelier={atelier} equipe={equipe} />
        <SlideSwitch
          on={mode === "cible"}
          onChange={(v) => setMode(v ? "cible" : "actuel")}
          offLabel="Actuel"
          onLabel="Cible"
          offColor="#1d4ed8"
          onColor="#16a34a"
          width={156}
          title="Basculer entre niveau actuel et niveau cible"
        />
        <Link href="/matrice/bilan" className="navlink" prefetch={false}>
          Voir le bilan &rarr;
        </Link>
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
