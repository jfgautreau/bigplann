"use client";

import { Fragment, useRef, useState } from "react";
import { LevelMark, FILL, RESTRICT } from "./Pie";

// Cycle de saisie : 0 -> 1 -> 2 -> 3 -> 4 -> ❌ (restriction) -> 0.
const CYCLE = [0, 1, 2, 3, 4, RESTRICT];
const lvlTxt = (n: number) => (n === RESTRICT ? "Restriction ❌" : String(n));

type Poste = { id: string; nom: string; objectifActuel?: number; objectifCible?: number };
type Group = { ligneId: string; ligneNom: string; postes: Poste[] };
type Personne = { id: string; label: string; editable: boolean };
type Cell = { a: number; c: number };

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
  const [showBilan, setShowBilan] = useState(true);
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

  const countAt = (poid: string, field: "a" | "c") =>
    personnes.reduce((n, pe) => n + ((cells[key(pe.id, poid)]?.[field] ?? 0) >= 2 ? 1 : 0), 0);
  const fieldShown: "a" | "c" = mode === "actuel" ? "a" : "c";
  const countLevel = (poid: string, level: number) =>
    personnes.reduce((n, pe) => n + ((cells[key(pe.id, poid)]?.[fieldShown] ?? 0) === level ? 1 : 0), 0);
  const countRestrict = (poid: string) =>
    personnes.reduce((n, pe) => n + ((cells[key(pe.id, poid)]?.[fieldShown] ?? 0) === RESTRICT ? 1 : 0), 0);

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
          body: JSON.stringify({ personne_id: pid, poste_id: poid, niveau_actuel: cell.a, niveau_cible: cell.c }),
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
      const idx = CYCLE.indexOf(cur[field]);
      const nextVal = CYCLE[(((idx < 0 ? 0 : idx) + delta) % CYCLE.length + CYCLE.length) % CYCLE.length];
      const next = { ...cur, [field]: nextVal };
      save(k, next, pid, poid);
      return { ...prev, [k]: next };
    });
  }

  const saveLabel =
    saveState === "saving" ? "Enregistrement..." : saveState === "saved" ? "Enregistré" : saveState === "error" ? "Échec d'enregistrement" : "";
  const saveColor = saveState === "error" ? "var(--danger)" : saveState === "saved" ? "var(--ok)" : "var(--muted)";

  const accentBg = mode === "actuel" ? "#dbeafe" : "#dcfce7";
  const accentFg = mode === "actuel" ? "#1d4ed8" : "#15803d";
  const sepL = (i: number) => (i === 0 ? "2px solid #d9dce1" : undefined);
  // Colonne noms adaptative (px) partagee par les 2 tables -> colonnes alignees.
  const nameW = Math.min(320, Math.max(150, personnes.reduce((m, p) => Math.max(m, p.label.length), 0) * 7.2 + 30));
  const Cols = () => (
    <colgroup>
      <col style={{ width: nameW }} />
      {groups.flatMap((g) => g.postes).map((p) => <col key={p.id} />)}
    </colgroup>
  );
  const tStyle: React.CSSProperties = { borderCollapse: "collapse", width: "100%", tableLayout: "fixed" };

  return (
    <>
      {/* Tableau 1 : en-tetes + bilan retractable (fixe) */}
      <div className="card" style={{ overflowX: "hidden", overflowY: "auto", scrollbarGutter: "stable", position: "relative", padding: "6px 10px" }}>
        <div style={{ position: "absolute", top: 6, right: 12, fontSize: 12, fontWeight: 600, color: saveColor, minHeight: 16, zIndex: 30 }}>
          {saveLabel}
        </div>

        <table className="matrix" style={tStyle}>
          <Cols />
          <thead>
            <tr>
              <th rowSpan={2} style={{ position: "sticky", left: 0, top: 0, zIndex: 26, background: "#fff", textAlign: "left", verticalAlign: "top" }}>
                <button
                  type="button"
                  onClick={() => setShowBilan((s) => !s)}
                  title={showBilan ? "Masquer le bilan" : "Afficher le bilan"}
                  style={{ width: "auto", margin: 0, padding: "1px 7px", fontSize: 12, fontWeight: 700, lineHeight: 1.4, border: "1px solid var(--border)", borderRadius: 6, background: "#fff", color: "var(--primary)", cursor: "pointer" }}
                >
                  {showBilan ? "− Bilan" : "+ Bilan"}
                </button>
              </th>
              {groups.map((g) => (
                <th key={g.ligneId} colSpan={g.postes.length} style={{ position: "sticky", top: 0, zIndex: 22, textAlign: "center", borderLeft: "2px solid #d9dce1", background: "#f8fafc" }}>
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
                    style={{ position: "sticky", top: 25, zIndex: 21, fontWeight: 500, borderLeft: sepL(i), padding: "4px 0", height: 96, verticalAlign: "bottom", background: accentBg }}
                  >
                    {/* Nom de poste vertical, sur 2 lignes si trop long. */}
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "normal", maxHeight: 86, margin: "0 auto", fontSize: 12, lineHeight: 1.15, overflowWrap: "anywhere", color: accentFg }}>
                      {p.nom}
                    </div>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {/* ---- Bilan (remonte sous les entetes, retractable) ---- */}
            {showBilan && (
              <>
                {[1, 2, 3, 4].map((lvl) => (
                  <tr key={`niv${lvl}`} style={{ background: "#fbfcfe" }}>
                    <td style={{ position: "sticky", left: 0, background: "#fbfcfe", fontWeight: 600, fontSize: 12, color: "#475569" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: FILL[lvl] ?? "#999", border: "1px solid #94a3b8", display: "inline-block", flexShrink: 0 }} />
                        Nb de Niv. {lvl}
                      </span>
                    </td>
                    {groups.flatMap((g) =>
                      g.postes.map((po, i) => {
                        const c = countLevel(po.id, lvl);
                        return (
                          <td key={po.id} style={{ textAlign: "center", padding: "3px 2px", fontWeight: 600, color: c > 0 ? "var(--text)" : "#cbd5e1", borderLeft: sepL(i) }}>{c}</td>
                        );
                      })
                    )}
                  </tr>
                ))}
                <tr style={{ background: "#fef2f2" }}>
                  <td style={{ position: "sticky", left: 0, background: "#fef2f2", fontWeight: 600, fontSize: 12, color: "#b91c1c" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      <span style={{ color: "#dc2626", fontWeight: 800 }}>✕</span>
                      Nb restreint
                    </span>
                  </td>
                  {groups.flatMap((g) =>
                    g.postes.map((po, i) => {
                      const c = countRestrict(po.id);
                      return (
                        <td key={po.id} style={{ textAlign: "center", padding: "3px 2px", fontWeight: 700, color: c > 0 ? "#dc2626" : "#e5c9c9", borderLeft: sepL(i) }}>{c || ""}</td>
                      );
                    })
                  )}
                </tr>
                {([
                  ["actuel", "a", "#1d4ed8", objActuel] as const,
                  ["cible", "c", "#16a34a", objCible] as const,
                ]).map(([champ, field, accent, objMap]) => (
                  <Fragment key={champ}>
                    <tr style={{ background: "#f1f5f9" }}>
                      <td style={{ position: "sticky", left: 0, background: "#f1f5f9", fontWeight: 700, color: accent }}>Objectif {champ}</td>
                      {groups.flatMap((g) =>
                        g.postes.map((po, i) => (
                          <td key={po.id} style={{ textAlign: "center", padding: "3px 2px", borderLeft: sepL(i) }}>
                            {canEditObjectif ? (
                              <input type="number" min={0} value={objMap[po.id] ?? 0} onChange={(e) => saveObjectif(po.id, champ, Math.max(0, Number(e.target.value) || 0))} style={{ width: 30, textAlign: "center", padding: 2 }} />
                            ) : (objMap[po.id] ?? 0)}
                          </td>
                        ))
                      )}
                    </tr>
                    <tr style={{ background: "#f8fafc" }}>
                      <td style={{ position: "sticky", left: 0, background: "#f8fafc", fontWeight: 600 }}>Compétences {champ} (≥2)</td>
                      {groups.flatMap((g) =>
                        g.postes.map((po, i) => {
                          const c = countAt(po.id, field);
                          const obj = objMap[po.id] ?? 0;
                          const manque = c < obj; // sous l'objectif -> rouge sur fond rouge
                          return (
                            <td key={po.id} style={{ textAlign: "center", padding: "3px 2px", fontWeight: 700, color: manque ? "#b91c1c" : "var(--ok)", background: manque ? "#fee2e2" : undefined, borderLeft: sepL(i) }} title={`${c} / objectif ${obj}${manque ? ` — manque ${obj - c}` : ""}`}>{c}</td>
                          );
                        })
                      )}
                    </tr>
                  </Fragment>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Tableau 2 : personnes (defile, hauteur limitee) */}
      <div className="card" style={{ marginTop: 8, overflowX: "hidden", overflowY: "auto", scrollbarGutter: "stable", maxHeight: "calc(100vh - 250px)", padding: "0 10px" }}>
        <table className="matrix" style={tStyle}>
          <Cols />
          <tbody>
            {personnes.map((pers) => (
              <tr key={pers.id}>
                <td style={{ background: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {pers.label}
                  {!pers.editable && <span className="muted"> (lecture)</span>}
                </td>
                {groups.flatMap((g) =>
                  g.postes.map((po, i) => {
                    const k = key(pers.id, po.id);
                    const cell = get(k);
                    const active = mode === "actuel" ? cell.a : cell.c;
                    const other = mode === "actuel" ? cell.c : cell.a;
                    const tdStyle = { textAlign: "center" as const, padding: 3, borderLeft: sepL(i) };
                    if (!pers.editable) {
                      return (
                        <td key={po.id} style={tdStyle}>
                          <div style={{ display: "inline-block", opacity: 0.85 }}><LevelMark level={active} /></div>
                        </td>
                      );
                    }
                    return (
                      <td key={po.id} style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => bump(pers.id, po.id, +1)}
                          onContextMenu={(e) => { e.preventDefault(); bump(pers.id, po.id, -1); }}
                          title={`${pers.label} - ${po.nom}\nActuel ${lvlTxt(cell.a)} / Cible ${lvlTxt(cell.c)}\nClic +1, clic droit -1 (❌ = restriction)`}
                          style={{ margin: 0, width: 34, height: 34, padding: 0, background: "transparent", border: "none", cursor: "pointer", position: "relative" }}
                        >
                          <LevelMark level={active} />
                          {other === RESTRICT ? (
                            <span style={{ position: "absolute", right: -1, bottom: -2, fontSize: 10, fontWeight: 800, color: "#dc2626" }}>✕</span>
                          ) : other > 0 ? (
                            <span style={{ position: "absolute", right: -1, bottom: -2, fontSize: 9, fontWeight: 600, color: "#6b7280" }}>{other}</span>
                          ) : null}
                        </button>
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
            {personnes.length === 0 && (
              <tr><td colSpan={allPostes.length + 1} className="muted">Aucune personne active.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
