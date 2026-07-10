"use client";

import HabMark from "./HabMark";

const LIGNES: { statut: "vert" | "orange" | "rouge" | "aucun"; titre: string; texte: string }[] = [
  { statut: "vert", titre: "Valable", texte: "plus de 90 jours avant échéance, ou formation sans date de validité." },
  { statut: "orange", titre: "Bientôt dépassée", texte: "entre 30 et 90 jours avant échéance : à replanifier." },
  { statut: "rouge", titre: "Plus valide", texte: "moins de 30 jours avant échéance, ou déjà expirée." },
  { statut: "aucun", titre: "Non habilité", texte: "aucune formation enregistrée pour cette personne sur ce poste." },
];

export default function HabLegendeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Statut des habilitations</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>
            ✕
          </button>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {LIGNES.map((l) => (
            <li key={l.statut} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ flexShrink: 0 }}>
                <HabMark statut={l.statut} />
              </span>
              <span>
                <strong>{l.titre}</strong> — {l.texte}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ marginTop: 10 }}>
          🚜 dans l&apos;en-tête d&apos;une colonne = formation soumise à autorisation de conduite (date propre à chaque personne,
          visible dans l&apos;infobulle de la case).
        </p>
        <p className="muted" style={{ marginTop: 6, fontWeight: 600 }}>
          Saisie : bouton « MàJ » en haut de la page. L&apos;échéance est calculée depuis la date de passage et la durée de validité.
        </p>
      </div>
    </div>
  );
}
