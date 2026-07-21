"use client";

import PeriodesEditor, { type RefletContrat } from "./PeriodesEditor";

// Modale d'edition des contrats / periodes d'une personne (autosave).
// `onSync` repercute sur la liste le contrat recalcule par l'API, sinon l'ecran
// principal garderait les anciennes valeurs jusqu'a un rechargement manuel.
export default function ContratsModal({
  personne,
  onClose,
  onSync,
}: {
  personne: { id: string; label: string };
  onClose: () => void;
  onSync?: (reflet: RefletContrat) => void;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1200, width: "96vw", maxHeight: "90vh", overflow: "auto" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Contrats — {personne.label}</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>✕</button>
        </div>
        <PeriodesEditor personneId={personne.id} bare onSync={onSync} />
      </div>
    </div>
  );
}
