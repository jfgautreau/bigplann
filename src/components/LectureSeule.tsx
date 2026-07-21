import type { ReactNode } from "react";

// Enveloppe un ecran de parametrage consulte SANS droit de modification.
//
// `<fieldset disabled>` desactive nativement TOUS les champs, listes et boutons
// imbriques : un seul point de passage, plutot que de penser a chaque controle
// (et a ceux qu'on ajoutera demain). Les styles par defaut du fieldset sont
// neutralises — `min-inline-size: 0` en particulier, sans quoi il impose une
// largeur minimale qui casse les mises en page en flex/grid.
//
// ⚠️ Ce n'est qu'un garde-fou d'interface : la vraie protection est la
// verification du droit cote serveur, dans chaque route API.
export default function LectureSeule({ actif, children }: { actif: boolean; children: ReactNode }) {
  if (!actif) return <>{children}</>;
  return (
    <>
      <p
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "0 0 14px",
          padding: "8px 12px",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--muted)",
          borderRadius: "0 8px 8px 0",
          background: "#f8fafc",
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        <span aria-hidden="true">👁</span>
        <span>
          <strong>Consultation seule.</strong> Vous pouvez voir ce paramétrage mais pas le modifier.
        </span>
      </p>
      <fieldset disabled style={{ border: "none", margin: 0, padding: 0, minInlineSize: 0 }}>
        {children}
      </fieldset>
    </>
  );
}
