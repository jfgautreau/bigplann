"use client";

import { useState } from "react";

type Poste = { id: string; nom: string };
type Cell = { debut: string; fin: string };

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function HoraireGrid({
  postes,
  initial,
}: {
  postes: Poste[];
  initial: Record<string, Cell>;
}) {
  const [vals, setVals] = useState<Record<string, Cell>>(initial);
  const key = (p: string, j: number) => `${p}:${j}`;
  const get = (p: string, j: number): Cell => vals[key(p, j)] ?? { debut: "", fin: "" };

  function set(p: string, j: number, champ: "debut" | "fin", v: string) {
    setVals((s) => ({ ...s, [key(p, j)]: { ...get(p, j), [champ]: v } }));
  }
  function copyLundi(p: string) {
    const lun = get(p, 0);
    setVals((s) => {
      const n = { ...s };
      for (let j = 1; j < 7; j++) n[key(p, j)] = { ...lun };
      return n;
    });
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="matrix" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", position: "sticky", left: 0, background: "#fff" }}>Poste</th>
            {JOURS.map((j) => (
              <th key={j} style={{ textAlign: "center", minWidth: 110 }}>{j}</th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {postes.map((p) => (
            <tr key={p.id}>
              <td style={{ position: "sticky", left: 0, background: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                {p.nom}
              </td>
              {JOURS.map((_, j) => {
                const c = get(p.id, j);
                return (
                  <td key={j} style={{ textAlign: "center", padding: 2 }}>
                    <input
                      type="time"
                      name={`debut_${p.id}_${j}`}
                      value={c.debut}
                      onChange={(e) => set(p.id, j, "debut", e.target.value)}
                      style={{ width: 92, fontSize: 12, padding: "2px 3px" }}
                    />
                    <input
                      type="time"
                      name={`fin_${p.id}_${j}`}
                      value={c.fin}
                      onChange={(e) => set(p.id, j, "fin", e.target.value)}
                      style={{ width: 92, fontSize: 12, padding: "2px 3px", marginTop: 2 }}
                    />
                  </td>
                );
              })}
              <td>
                <button type="button" className="btn-sm btn-ghost" onClick={() => copyLundi(p.id)} title="Copier le lundi sur toute la semaine">
                  Lun &rarr; sem.
                </button>
              </td>
            </tr>
          ))}
          {postes.length === 0 && (
            <tr>
              <td colSpan={9} className="muted">Aucun poste sur cette ligne.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
