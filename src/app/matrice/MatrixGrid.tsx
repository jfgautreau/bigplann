"use client";

import { useRef, useState } from "react";

type Poste = { id: string; nom: string };
type Group = { ligneId: string; ligneNom: string; postes: Poste[] };
type Personne = { id: string; label: string; editable: boolean };
type Cell = { a: number; c: number };

const BLUE = "#1d4ed8";
const GREEN = "#16a34a";

// Camembert qui se remplit selon le niveau (0..4).
function Pie({ level }: { level: number }) {
  const size = 28,
    r = 11,
    cx = 14,
    cy = 14;
  const f = Math.max(0, Math.min(4, level)) / 4;
  const fill = level >= 4 ? GREEN : BLUE;

  let inner = null;
  if (f >= 1) {
    inner = <circle cx={cx} cy={cy} r={r} fill={fill} />;
  } else if (f > 0) {
    const ang = -90 + 360 * f;
    const rad = (d: number) => (d * Math.PI) / 180;
    const x = cx + r * Math.cos(rad(ang));
    const y = cy + r * Math.sin(rad(ang));
    const large = f > 0.5 ? 1 : 0;
    inner = (
      <path
        d={`M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${large} 1 ${x},${y} Z`}
        fill={fill}
      />
    );
  }
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#1e3a8a" strokeWidth={1.5} />
      {inner}
    </svg>
  );
}

export default function MatrixGrid({
  groups = [],
  personnes = [],
  initial = {},
}: {
  groups?: Group[];
  personnes?: Personne[];
  initial?: Record<string, Cell>;
}) {
  const [mode, setMode] = useState<"actuel" | "cible">("actuel");
  const [cells, setCells] = useState<Record<string, Cell>>(initial);
  const [status, setStatus] = useState<Record<string, "saving" | "saved" | "error" | undefined>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const allPostes = groups.flatMap((g) => g.postes);
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
        if (res.ok) setTimeout(() => setStatus((s) => ({ ...s, [k]: undefined })), 900);
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

  const ringFor = (k: string) =>
    status[k] === "saving"
      ? "0 0 0 2px #1d4ed8"
      : status[k] === "saved"
        ? "0 0 0 2px #16a34a"
        : status[k] === "error"
          ? "0 0 0 2px #b91c1c"
          : "none";

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
        <span className="muted">Clic = +1 · clic droit = −1 · enregistrement automatique</span>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="matrix" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ position: "sticky", left: 0, background: "#fff", textAlign: "left" }}>
                Personne
              </th>
              {groups.map((g) => (
                <th
                  key={g.ligneId}
                  colSpan={g.postes.length}
                  style={{ textAlign: "center", borderLeft: "2px solid #d9dce1" }}
                >
                  {g.ligneNom}
                </th>
              ))}
            </tr>
            <tr>
              {groups.flatMap((g) =>
                g.postes.map((p, i) => (
                  <th
                    key={p.id}
                    style={{
                      textAlign: "center",
                      fontWeight: 500,
                      borderLeft: i === 0 ? "2px solid #d9dce1" : undefined,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.nom}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {personnes.map((pers) => (
              <tr key={pers.id}>
                <td style={{ position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>
                  {pers.label}
                  {!pers.editable && <span className="muted"> (lecture)</span>}
                </td>
                {groups.flatMap((g) =>
                  g.postes.map((po, i) => {
                    const k = key(pers.id, po.id);
                    const cell = get(k);
                    const active = mode === "actuel" ? cell.a : cell.c;
                    const other = mode === "actuel" ? cell.c : cell.a;
                    const tdStyle = {
                      textAlign: "center" as const,
                      padding: 3,
                      borderLeft: i === 0 ? "2px solid #d9dce1" : undefined,
                    };
                    if (!pers.editable) {
                      return (
                        <td key={po.id} style={tdStyle}>
                          <div style={{ display: "inline-block", opacity: 0.85 }}>
                            <Pie level={active} />
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={po.id} style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => bump(pers.id, po.id, +1)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            bump(pers.id, po.id, -1);
                          }}
                          title={`${pers.label} - ${po.nom}\nActuel ${cell.a} / Cible ${cell.c}\nClic +1, clic droit -1`}
                          style={{
                            margin: 0,
                            width: 34,
                            height: 34,
                            padding: 0,
                            background: "transparent",
                            border: "none",
                            borderRadius: "50%",
                            cursor: "pointer",
                            boxShadow: ringFor(k),
                            position: "relative",
                          }}
                        >
                          <Pie level={active} />
                          {other > 0 && (
                            <span
                              style={{
                                position: "absolute",
                                right: -1,
                                bottom: -2,
                                fontSize: 9,
                                fontWeight: 600,
                                color: "#6b7280",
                              }}
                            >
                              {other}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
            {personnes.length === 0 && (
              <tr>
                <td colSpan={allPostes.length + 1} className="muted">
                  Aucune personne active.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legende */}
      <div className="toolbar" style={{ marginTop: 10, gap: 16 }}>
        {[
          [0, "Non forme"],
          [1, "Niveau 1"],
          [2, "Niveau 2"],
          [3, "Niveau 3"],
          [4, "Expert (4)"],
        ].map(([n, label]) => (
          <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Pie level={n as number} />
            <span className="muted">{label}</span>
          </span>
        ))}
        <span className="muted">
          Le petit chiffre dans le coin = l&apos;autre niveau (la cible quand vous
          saisissez l&apos;actuel, et inversement).
        </span>
      </div>
    </div>
  );
}
