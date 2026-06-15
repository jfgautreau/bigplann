"use client";

import { Pie } from "./Pie";

const FALLBACK: Record<number, string> = {
  0: "Non formé.",
  1: "Comprend et connaît les instructions et règles de sécurité du poste.",
  2: "+ Garantit le niveau de qualité standard.",
  3: "+ Garantit les temps standards. Capable d'expliquer et de guider un opérateur de niveau inférieur.",
  4: "+ A formé avec succès un autre opérateur jusqu'au niveau 3. Maîtrise complète et capacité de transfert.",
};

export default function LegendeModal({
  niveauLibelles,
  onClose,
}: {
  niveauLibelles: { niveau: number; libelle: string }[];
  onClose: () => void;
}) {
  const label = (n: number) => niveauLibelles.find((x) => x.niveau === n)?.libelle || FALLBACK[n];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Niveaux de compétence</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>✕</button>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {[0, 1, 2, 3, 4].map((n) => (
            <li key={n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ flexShrink: 0 }}><Pie level={n} /></span>
              <span><strong>Niveau {n}</strong> — {label(n)}</span>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ marginTop: 10 }}>
          Le petit chiffre dans le coin d&apos;une case = l&apos;autre niveau (la cible quand vous saisissez l&apos;actuel, et inversement).
        </p>
        <p className="muted" style={{ marginTop: 6, fontWeight: 600 }}>
          Saisie : clic = +1 · clic droit = −1 · enregistrement automatique.
        </p>
      </div>
    </div>
  );
}
