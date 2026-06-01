"use client";

import { useRef, useState } from "react";

type Poste = { id: string; nom: string };
type Group = { ligneId: string; ligneNom: string; postes: Poste[] };
type Personne = { id: string; label: string; editable: boolean };
type Cell = { a: number; c: number };

// Progression de couleur par niveau (0 -> 4) : du non-forme au expert.
const FILL: Record<number, string | null> = {
  0: null, // contour seul
  1: "#dc2626", // rouge
  2: "#f59e0b", // orange
  3: "#84cc16", // vert clair (lime)
  4: "#16a34a", // vert (expert)
};

// Definitions officielles (carre magique, cf. cahier des charges 6.1).
const CARRE_MAGIQUE: [number, string][] = [
  [0, "Non formé."],
  [1, "Comprend et connaît les instructions et règles de sécurité du poste."],
  [2, "+ Garantit le niveau de qualité standard."],
  [
    3,
    "+ Garantit les temps standards. Capable d'expliquer et de guider un opérateur de niveau inférieur.",
  ],
  [
    4,
    "+ A formé avec succès un autre opérateur jusqu'au niveau 3. Maîtrise complète et capacité de transfert.",
  ],
];

function Pie({ level }: { level: number }) {
  const size = 28,
    r = 11,
    cx = 14,
    cy = 14;
  const lvl = Math.max(0, Math.min(4, level));
  const f = lvl / 4;
  const fill = FILL[lvl];

  let inner = null;
  if (fill && f >= 1) {
    inner = <circle cx={cx} cy={cy} r={r} fill={fill} />;
  } else if (fill && f > 0) {
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
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#64748b" strokeWidth={1.5} />
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allPostes = groups.flatMap((g) => g.postes);
  const key = (pid: string, poid: string) => `${pid}:${poid}`;
  const get = (k: string): Cell => cells[k] ?? { a: 0, c: 0 };

  function save(k: string, cell: Cell, pid: string, poid: string) {
    setSaveState("saving");
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
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState("idle"), 1500);
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

  const saveLabel =
    saveState === "saving"
      ? "Enregistrement..."
      : saveState === "saved"
        ? "Enregistre"
        : saveState === "error"
          ? "Echec d'enregistrement"
          : "";
  const saveColor =
    saveState === "error" ? "var(--danger)" : saveState === "saved" ? "var(--ok)" : "var(--muted)";

  return (
    <div>
      <div className="toolbar" style={{ alignItems: "center" }}>
        <span className="muted">Je saisis le niveau :</span>
        <div className="modeswitch">
          <button
            type="button"
            className={mode === "actuel" ? "on-actuel" : ""}
            onClick={() => setMode("actuel")}
          >
            Niveau actuel
          </button>
          <button
            type="button"
            className={mode === "cible" ? "on-cible" : ""}
            onClick={() => setMode("cible")}
          >
            Niveau cible
          </button>
        </div>
        <span className="muted">Clic = +1 · clic droit = −1 · enregistrement automatique</span>
      </div>

      <div className="card" style={{ overflowX: "auto", position: "relative" }}>
        {/* Indicateur de sauvegarde unique, en haut a droite du tableau */}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 12,
            fontSize: 12,
            fontWeight: 600,
            color: saveColor,
            minHeight: 16,
          }}
        >
          {saveLabel}
        </div>

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
                            cursor: "pointer",
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

      {/* Legende : carre magique (cahier des charges) */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, marginTop: 0 }}>Niveaux (carre magique)</h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {CARRE_MAGIQUE.map(([n, txt]) => (
            <li
              key={n}
              style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}
            >
              <Pie level={n} />
              <span>
                <strong>Niveau {n}</strong> — {txt}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ marginTop: 8 }}>
          Le petit chiffre dans le coin d&apos;une case = l&apos;autre niveau (la cible
          quand vous saisissez l&apos;actuel, et inversement).
        </p>
      </div>
    </div>
  );
}
