"use client";

import { useRef, useState } from "react";

type Poste = { id: string; nom: string };
type Personne = { id: string; label: string; editable: boolean };
type Cell = { a: number; c: number };

const COLORS: Record<number, { bg: string; fg: string }> = {
  0: { bg: "#f3f4f6", fg: "#6b7280" },
  1: { bg: "#fee2e2", fg: "#991b1b" },
  2: { bg: "#ffedd5", fg: "#9a3412" },
  3: { bg: "#dcfce7", fg: "#166534" },
  4: { bg: "#16a34a", fg: "#ffffff" },
};

export default function MatrixGrid({
  postes,
  personnes,
  initial,
}: {
  postes: Poste[];
  personnes: Personne[];
  initial: Record<string, Cell>;
}) {
  const [mode, setMode] = useState<"actuel" | "cible">("actuel");
  const [cells, setCells] = useState<Record<string, Cell>>(initial);
  const [status, setStatus] = useState<Record<string, "saving" | "saved" | "error">>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const key = (pid: string, poid: string) => `${pid}:${poid}`;
  const get = (k: string): Cell => cells[k] ?? { a: 0, c: 0 };

  function save(k: string, cell: Cell, pid: string, poid: string) {
    setStatus((s) => ({ ...s, [k]: "saving" }));
    if (timers.current[k]) clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(async () => {
      try {
        const res = await fetch("/api/matrice/cell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personne_id: pid,
            poste_id: poid,
            niveau_actuel: cell.a,
            niveau_cible: cell.c,
          }),
        });
        setStatus((s) => ({ ...s, [k]: res.ok ? "saved" : "error" }));
        if (res.ok) setTimeout(() => setStatus((s) => ({ ...s, [k]: undefined as never })), 900);
      } catch {
        setStatus((s) => ({ ...s, [k]: "error" }));
      }
    }, 450);
  }

  function bump(pid: string, poid: string, delta: number) {
    const k = key(pid, poid);
    setCells((prev) => {
      const cur = prev[k] ?? { a: 0, c: 0 };
      const field = mode === "actuel" ? "a" : "c";
      const next = { ...cur, [field]: (cur[field] + delta + 5) % 5 };
      save(k, next, pid, poid);
      return { ...prev, [k]: next };
    });
  }

  const borderFor = (k: string) =>
    status[k] === "saving"
      ? "2px solid #1d4ed8"
      : status[k] === "saved"
        ? "2px solid #16a34a"
        : status[k] === "error"
          ? "2px solid #b91c1c"
          : "2px solid transparent";

  return (
    <div>
      <div className="toolbar" style={{ alignItems: "center" }}>
        <span className="muted">Je saisis le niveau :</span>
        <div className="modes" style={{ marginBottom: 0 }}>
          <label className="mode">
            <input type="radio" checked={mode === "actuel"} onChange={() => setMode("actuel")} />
            Actuel
          </label>
          <label className="mode">
            <input type="radio" checked={mode === "cible"} onChange={() => setMode("cible")} />
            Cible
          </label>
        </div>
        <span className="muted">
          Clic = +1 · clic droit = −1 · enregistrement automatique
        </span>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="matrix">
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: "#fff" }}>Personne</th>
              {postes.map((p) => (
                <th key={p.id} style={{ textAlign: "center" }}>{p.nom}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personnes.map((pers) => (
              <tr key={pers.id}>
                <td style={{ position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>
                  {pers.label}
                  {!pers.editable && <span className="muted"> (lecture)</span>}
                </td>
                {postes.map((po) => {
                  const k = key(pers.id, po.id);
                  const cell = get(k);
                  const active = mode === "actuel" ? cell.a : cell.c;
                  const other = mode === "actuel" ? cell.c : cell.a;
                  const col = COLORS[active];
                  if (!pers.editable) {
                    return (
                      <td key={po.id} style={{ textAlign: "center" }}>
                        <span className="muted">{cell.a}/{cell.c}</span>
                      </td>
                    );
                  }
                  return (
                    <td key={po.id} style={{ textAlign: "center", padding: 3 }}>
                      <button
                        type="button"
                        onClick={() => bump(pers.id, po.id, +1)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          bump(pers.id, po.id, -1);
                        }}
                        title={`Actuel ${cell.a} / Cible ${cell.c}`}
                        style={{
                          margin: 0,
                          width: 46,
                          height: 40,
                          background: col.bg,
                          color: col.fg,
                          border: borderFor(k),
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 16,
                          cursor: "pointer",
                          position: "relative",
                          lineHeight: 1,
                        }}
                      >
                        {active}
                        <span
                          style={{
                            position: "absolute",
                            right: 3,
                            bottom: 2,
                            fontSize: 9,
                            fontWeight: 500,
                            opacity: 0.7,
                          }}
                        >
                          {mode === "actuel" ? "c" : "a"}
                          {other}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {personnes.length === 0 && (
              <tr>
                <td colSpan={postes.length + 1} className="muted">
                  Aucune personne active.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 10 }}>
        Legende niveaux :
        {[0, 1, 2, 3, 4].map((n) => (
          <span
            key={n}
            style={{
              display: "inline-block",
              margin: "0 4px",
              padding: "2px 8px",
              borderRadius: 4,
              background: COLORS[n].bg,
              color: COLORS[n].fg,
              fontWeight: 700,
            }}
          >
            {n}
          </span>
        ))}
      </p>
    </div>
  );
}
