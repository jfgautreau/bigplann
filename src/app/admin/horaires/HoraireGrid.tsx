"use client";

import { useState } from "react";

type Poste = { id: string; nom: string };
type Quart = { code: string; libelle: string; debut: string; fin: string };
type Cell = { debut: string; fin: string };

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function HoraireGrid({
  postes,
  quarts,
  initial,
}: {
  postes: Poste[];
  quarts: Quart[];
  initial: Record<string, Cell>;
}) {
  const [vals, setVals] = useState<Record<string, Cell>>(initial);
  const key = (p: string, q: string, j: number) => `${p}:${q}:${j}`;
  const get = (p: string, q: string, j: number): Cell => vals[key(p, q, j)] ?? { debut: "", fin: "" };

  function set(p: string, q: string, j: number, champ: "debut" | "fin", v: string) {
    setVals((s) => ({ ...s, [key(p, q, j)]: { ...get(p, q, j), [champ]: v } }));
  }

  // Recopie le lundi sur tous les autres jours (meme poste, meme quart).
  function copyLundi(p: string, q: string) {
    const lun = get(p, q, 0);
    setVals((s) => {
      const n = { ...s };
      for (let j = 1; j < 7; j++) n[key(p, q, j)] = { ...lun };
      return n;
    });
  }

  // Remplit toute la semaine avec l'horaire par defaut du quart.
  function fillDefaut(p: string, q: string, debut: string, fin: string) {
    setVals((s) => {
      const n = { ...s };
      for (let j = 0; j < 7; j++) n[key(p, q, j)] = { debut, fin };
      return n;
    });
  }

  // Recopie cette ligne (poste+quart, 7 jours) sur le meme quart de tous les autres postes.
  function copyAutresPostes(p: string, q: string) {
    if (!window.confirm("Recopier ces horaires sur le même quart de tous les autres postes de la ligne ?")) return;
    setVals((s) => {
      const n = { ...s };
      for (const other of postes) {
        if (other.id === p) continue;
        for (let j = 0; j < 7; j++) n[key(other.id, q, j)] = { ...get(p, q, j) };
      }
      return n;
    });
  }

  return (
    <div>
      {postes.map((po) => (
        <div key={po.id} className="card section" style={{ overflowX: "auto" }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>{po.nom}</h2>
          <table className="matrix" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", minWidth: 96 }}>Quart</th>
                {JOURS.map((j) => (
                  <th key={j} style={{ textAlign: "center", minWidth: 96 }}>{j}</th>
                ))}
                <th style={{ minWidth: 150 }}></th>
              </tr>
            </thead>
            <tbody>
              {quarts.map((q) => (
                <tr key={q.code}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{q.libelle}</td>
                  {JOURS.map((_, j) => {
                    const c = get(po.id, q.code, j);
                    return (
                      <td key={j} style={{ textAlign: "center", padding: 2 }}>
                        <input
                          type="time"
                          name={`debut_${po.id}_${q.code}_${j}`}
                          value={c.debut}
                          onChange={(e) => set(po.id, q.code, j, "debut", e.target.value)}
                          style={{ width: 84, fontSize: 12, padding: "2px 3px" }}
                        />
                        <input
                          type="time"
                          name={`fin_${po.id}_${q.code}_${j}`}
                          value={c.fin}
                          onChange={(e) => set(po.id, q.code, j, "fin", e.target.value)}
                          style={{ width: 84, fontSize: 12, padding: "2px 3px", marginTop: 2 }}
                        />
                      </td>
                    );
                  })}
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn-sm btn-ghost" onClick={() => copyLundi(po.id, q.code)} title="Recopier le lundi sur toute la semaine">
                      Lun &rarr; sem.
                    </button>{" "}
                    <button
                      type="button"
                      className="btn-sm btn-ghost"
                      onClick={() => fillDefaut(po.id, q.code, q.debut, q.fin)}
                      title={`Remplir la semaine avec l'horaire par défaut du quart (${q.debut || "?"}-${q.fin || "?"})`}
                    >
                      Défaut
                    </button>{" "}
                    {postes.length > 1 && (
                      <button type="button" className="btn-sm btn-ghost" onClick={() => copyAutresPostes(po.id, q.code)} title="Recopier sur le même quart de tous les autres postes">
                        &darr; postes
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {postes.length === 0 && <p className="muted">Aucun poste sur cette ligne.</p>}
    </div>
  );
}
