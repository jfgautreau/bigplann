"use client";

import { Fragment, useRef, useState } from "react";

type Poste = { id: string; nom: string; objectifActuel?: number; objectifCible?: number };
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
  canEditObjectif = false,
  mode = "actuel",
}: {
  groups?: Group[];
  personnes?: Personne[];
  initial?: Record<string, Cell>;
  canEditObjectif?: boolean;
  mode?: "actuel" | "cible";
}) {
  const [cells, setCells] = useState<Record<string, Cell>>(initial);
  const [objActuel, setObjActuel] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const g of groups) for (const p of g.postes) o[p.id] = p.objectifActuel ?? 0;
    return o;
  });
  const [objCible, setObjCible] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const g of groups) for (const p of g.postes) o[p.id] = p.objectifCible ?? 0;
    return o;
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const objTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allPostes = groups.flatMap((g) => g.postes);
  const key = (pid: string, poid: string) => `${pid}:${poid}`;
  const get = (k: string): Cell => cells[k] ?? { a: 0, c: 0 };

  // Bilan : nb de personnes competentes (niveau >= 2) par poste
  const countAt = (poid: string, field: "a" | "c") =>
    personnes.reduce((n, pe) => n + ((cells[key(pe.id, poid)]?.[field] ?? 0) >= 2 ? 1 : 0), 0);

  // Repartition : nb de personnes a un niveau EXACT, sur le niveau affiche
  // (actuel ou cible selon le mode courant, pour coller aux pastilles visibles).
  const fieldShown: "a" | "c" = mode === "actuel" ? "a" : "c";
  const countLevel = (poid: string, level: number) =>
    personnes.reduce((n, pe) => n + ((cells[key(pe.id, poid)]?.[fieldShown] ?? 0) === level ? 1 : 0), 0);

  function saveObjectif(poid: string, champ: "actuel" | "cible", value: number) {
    if (champ === "actuel") setObjActuel((o) => ({ ...o, [poid]: value }));
    else setObjCible((o) => ({ ...o, [poid]: value }));
    setSaveState("saving");
    const tk = `${poid}:${champ}`;
    if (objTimers.current[tk]) clearTimeout(objTimers.current[tk]);
    objTimers.current[tk] = setTimeout(async () => {
      try {
        const res = await fetch("/api/poste/objectif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ poste_id: poid, champ, objectif: value }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState("idle"), 1500);
    }, 500);
  }

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
        ? "Enregistré"
        : saveState === "error"
          ? "Échec d'enregistrement"
          : "";
  const saveColor =
    saveState === "error" ? "var(--danger)" : saveState === "saved" ? "var(--ok)" : "var(--muted)";

  return (
    <div>
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

        <table className="matrix" style={{ borderCollapse: "collapse", width: "auto" }}>
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
                    title={p.nom}
                    style={{
                      fontWeight: 500,
                      borderLeft: i === 0 ? "2px solid #d9dce1" : undefined,
                      padding: "4px 0",
                      verticalAlign: "bottom",
                    }}
                  >
                    {/* Nom de poste vertical (lecture bas->haut) : colonnes resserrees
                        a la largeur d'une pastille pour tout afficher sur une page. */}
                    <div
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        whiteSpace: "nowrap",
                        margin: "0 auto",
                        fontSize: 12,
                        lineHeight: 1.1,
                      }}
                    >
                      {p.nom}
                    </div>
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
          <tfoot>
            {/* Repartition par niveau (niveau affiche : actuel ou cible). */}
            {[1, 2, 3, 4].map((lvl) => (
              <tr key={`niv${lvl}`} style={{ background: "#fbfcfe" }}>
                <td style={{ position: "sticky", left: 0, background: "#fbfcfe", fontWeight: 600, fontSize: 12, color: "#475569" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: FILL[lvl] ?? "#999",
                        border: "1px solid #94a3b8",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    Nb de Niv. {lvl}
                  </span>
                </td>
                {groups.flatMap((g) =>
                  g.postes.map((po, i) => {
                    const c = countLevel(po.id, lvl);
                    return (
                      <td
                        key={po.id}
                        style={{
                          textAlign: "center",
                          padding: "3px 2px",
                          fontWeight: 600,
                          color: c > 0 ? "var(--text)" : "#cbd5e1",
                          borderLeft: i === 0 ? "2px solid #d9dce1" : undefined,
                        }}
                      >
                        {c}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
            {(
              [
                ["actuel", "a", "#1d4ed8", objActuel] as const,
                ["cible", "c", "#16a34a", objCible] as const,
              ]
            ).map(([champ, field, accent, objMap]) => (
              <Fragment key={champ}>
                <tr style={{ background: "#f1f5f9" }}>
                  <td style={{ position: "sticky", left: 0, background: "#f1f5f9", fontWeight: 700, color: accent }}>
                    Objectif {champ}
                  </td>
                  {groups.flatMap((g) =>
                    g.postes.map((po, i) => (
                      <td key={po.id} style={{ textAlign: "center", padding: "3px 2px", borderLeft: i === 0 ? "2px solid #d9dce1" : undefined }}>
                        {canEditObjectif ? (
                          <input
                            type="number"
                            min={0}
                            value={objMap[po.id] ?? 0}
                            onChange={(e) => saveObjectif(po.id, champ, Math.max(0, Number(e.target.value) || 0))}
                            style={{ width: 30, textAlign: "center", padding: 2 }}
                          />
                        ) : (
                          objMap[po.id] ?? 0
                        )}
                      </td>
                    ))
                  )}
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td style={{ position: "sticky", left: 0, background: "#f8fafc", fontWeight: 600 }}>
                    Compétences {champ} (≥2)
                  </td>
                  {groups.flatMap((g) =>
                    g.postes.map((po, i) => {
                      const c = countAt(po.id, field);
                      const obj = objMap[po.id] ?? 0;
                      return (
                        <td
                          key={po.id}
                          style={{
                            textAlign: "center",
                            padding: "3px 2px",
                            fontWeight: 700,
                            color: c < obj ? "var(--danger)" : "var(--ok)",
                            borderLeft: i === 0 ? "2px solid #d9dce1" : undefined,
                          }}
                          title={`${c} / objectif ${obj}`}
                        >
                          {c}
                        </td>
                      );
                    })
                  )}
                </tr>
              </Fragment>
            ))}
          </tfoot>
        </table>
      </div>

      {/* Legende : carre magique (cahier des charges) */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, marginTop: 0 }}>Niveaux (carré magique)</h2>
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
