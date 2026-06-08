"use client";

import { useMemo, useState } from "react";

type Cell = { debut: string; fin: string };
type Poste = { id: string; nom: string };
type LigneGroup = {
  ligneId: string;
  ligneNom: string;
  atelierId: string;
  atelierNom: string;
  postes: Poste[];
};
type Quart = { code: string; libelle: string };
type AtelierOpt = { id: string; nom: string };

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function HoraireEditor({
  ateliers,
  lignes,
  quarts,
  initial,
}: {
  ateliers: AtelierOpt[];
  lignes: LigneGroup[];
  quarts: Quart[];
  initial: Record<string, Cell>;
}) {
  const [vals, setVals] = useState<Record<string, Cell>>(initial);
  const [atelier, setAtelier] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [clip, setClip] = useState<{ from: string; cells: Record<string, Cell> } | null>(null);
  const [bulkQuart, setBulkQuart] = useState(quarts[0]?.code ?? "");

  const key = (p: string, q: string, j: number) => `${p}:${q}:${j}`;
  const get = (p: string, q: string, j: number): Cell => vals[key(p, q, j)] ?? { debut: "", fin: "" };
  const set = (p: string, q: string, j: number, champ: "debut" | "fin", v: string) =>
    setVals((s) => ({ ...s, [key(p, q, j)]: { ...get(p, q, j), [champ]: v } }));

  // Lignes regroupees par atelier (deja triees atelier puis ligne cote serveur).
  const byAtelier = useMemo(() => {
    const m = new Map<string, { atelierId: string; atelierNom: string; lignes: LigneGroup[] }>();
    for (const l of lignes) {
      const g = m.get(l.atelierId) ?? { atelierId: l.atelierId, atelierNom: l.atelierNom, lignes: [] };
      g.lignes.push(l);
      m.set(l.atelierId, g);
    }
    return [...m.values()];
  }, [lignes]);

  // Postes visibles (selon le filtre atelier) : portee des suppressions ciblees.
  const visiblePosteIds = useMemo(
    () => lignes.filter((l) => !atelier || l.atelierId === atelier).flatMap((l) => l.postes.map((p) => p.id)),
    [lignes, atelier]
  );
  const nomPoste = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of lignes) for (const p of l.postes) m[p.id] = p.nom;
    return m;
  }, [lignes]);

  // -- Actions par poste --
  function copyLundi(p: string, q: string) {
    const lun = get(p, q, 0);
    setVals((s) => {
      const n = { ...s };
      for (let j = 1; j < 7; j++) n[key(p, q, j)] = { ...lun };
      return n;
    });
  }
  function copierPoste(p: string) {
    const cells: Record<string, Cell> = {};
    for (const q of quarts) for (let j = 0; j < 7; j++) cells[`${q.code}:${j}`] = { ...get(p, q.code, j) };
    setClip({ from: p, cells });
  }
  function collerPoste(p: string) {
    if (!clip) return;
    setVals((s) => {
      const n = { ...s };
      for (const q of quarts) for (let j = 0; j < 7; j++) {
        const c = clip.cells[`${q.code}:${j}`];
        if (c) n[key(p, q.code, j)] = { ...c };
      }
      return n;
    });
  }
  function copyAutresPostes(ligne: LigneGroup, p: string) {
    if (!window.confirm("Recopier ces horaires sur tous les autres postes de la ligne ?")) return;
    setVals((s) => {
      const n = { ...s };
      for (const other of ligne.postes) {
        if (other.id === p) continue;
        for (const q of quarts) for (let j = 0; j < 7; j++) n[key(other.id, q.code, j)] = { ...get(p, q.code, j) };
      }
      return n;
    });
  }

  // -- Suppressions ciblees (sur les postes visibles) --
  const porteeLabel = atelier ? "l'atelier sélectionné" : "tous les ateliers";
  function viderJour(j: number) {
    if (!window.confirm(`Vider tous les horaires du ${JOURS[j]} (${porteeLabel}) ?`)) return;
    setVals((s) => {
      const n = { ...s };
      for (const pid of visiblePosteIds) for (const q of quarts) delete n[key(pid, q.code, j)];
      return n;
    });
  }
  function viderQuart(qc: string) {
    const q = quarts.find((x) => x.code === qc);
    if (!q) return;
    if (!window.confirm(`Vider tous les horaires du quart « ${q.libelle} » (${porteeLabel}) ?`)) return;
    setVals((s) => {
      const n = { ...s };
      for (const pid of visiblePosteIds) for (let j = 0; j < 7; j++) delete n[key(pid, qc, j)];
      return n;
    });
  }

  const toggle = (lid: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(lid) ? n.delete(lid) : n.add(lid);
      return n;
    });
  const allLigneIds = lignes.map((l) => l.ligneId);
  const allCollapsed = allLigneIds.every((id) => collapsed.has(id));
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(allLigneIds));

  return (
    <div>
      {/* Barre d'outils : ateliers + suppressions ciblees */}
      <div className="card" style={{ position: "sticky", top: 0, zIndex: 6, marginBottom: 16 }}>
        <div className="toolbar" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <span className="muted">Atelier :</span>
          <div className="segments">
            <button type="button" className={atelier === "" ? "seg active" : "seg"} onClick={() => setAtelier("")}>
              Tous
            </button>
            {ateliers.map((a) => (
              <button
                key={a.id}
                type="button"
                className={atelier === a.id ? "seg active" : "seg"}
                onClick={() => setAtelier(a.id)}
              >
                {a.nom}
              </button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn-sm btn-ghost" onClick={toggleAll}>
            {allCollapsed ? "Tout déplier" : "Tout replier"}
          </button>
        </div>
        <div className="toolbar" style={{ alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <span className="muted">Vider ({porteeLabel}) :</span>
          <button type="button" className="btn-sm btn-ghost" onClick={() => viderJour(5)}>
            Samedi
          </button>
          <button type="button" className="btn-sm btn-ghost" onClick={() => viderJour(6)}>
            Dimanche
          </button>
          <span style={{ marginLeft: 8 }} className="muted">
            Quart :
          </span>
          <select value={bulkQuart} onChange={(e) => setBulkQuart(e.target.value)} style={{ width: "auto" }}>
            {quarts.map((q) => (
              <option key={q.code} value={q.code}>
                {q.libelle}
              </option>
            ))}
          </select>
          <button type="button" className="btn-sm btn-ghost" onClick={() => viderQuart(bulkQuart)}>
            Vider ce quart
          </button>
          {clip && (
            <span className="clip-banner">
              Horaires de « {nomPoste[clip.from] ?? "?"} » copiés — cliquez « Coller » sur un poste.
              <button type="button" className="btn-sm btn-ghost" onClick={() => setClip(null)} style={{ marginLeft: 8 }}>
                Annuler
              </button>
            </span>
          )}
        </div>
      </div>

      {byAtelier.map((grp) => {
        const showAtelier = !atelier || grp.atelierId === atelier;
        return (
          <div key={grp.atelierId || "none"} style={{ display: showAtelier ? undefined : "none" }}>
            <h2 style={{ fontSize: 18, margin: "18px 0 8px" }}>{grp.atelierNom}</h2>
            {grp.lignes.map((l) => {
              const isCol = collapsed.has(l.ligneId);
              return (
                <div key={l.ligneId} className="card section">
                  <div
                    className="toolbar"
                    style={{ alignItems: "center", cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggle(l.ligneId)}
                  >
                    <span style={{ fontWeight: 700, fontSize: 15 }}>
                      {isCol ? "▸" : "▾"} {l.ligneNom}
                    </span>
                    <span className="muted">
                      {l.postes.length} poste{l.postes.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Toujours dans le DOM (display:none si replie) pour que le form soumette tout. */}
                  <div style={{ display: isCol ? "none" : "block" }}>
                    {l.postes.map((po) => (
                      <div key={po.id} className="section" style={{ overflowX: "auto", marginLeft: 8 }}>
                        <div className="toolbar" style={{ alignItems: "center", gap: 6 }}>
                          <h3 style={{ margin: 0, fontSize: 14 }}>{po.nom}</h3>
                          <button type="button" className="btn-sm btn-ghost" onClick={() => copierPoste(po.id)} title="Copier les horaires de ce poste">
                            Copier
                          </button>
                          <button
                            type="button"
                            className="btn-sm btn-ghost"
                            onClick={() => collerPoste(po.id)}
                            disabled={!clip}
                            title={clip ? "Coller les horaires copiés ici" : "Copiez d'abord un poste"}
                          >
                            Coller
                          </button>
                          {l.postes.length > 1 && (
                            <button
                              type="button"
                              className="btn-sm btn-ghost"
                              onClick={() => copyAutresPostes(l, po.id)}
                              title="Recopier sur tous les autres postes de la ligne"
                            >
                              ↓ postes
                            </button>
                          )}
                        </div>
                        <table className="matrix" style={{ borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", minWidth: 96 }}>Quart</th>
                              {JOURS.map((j) => (
                                <th key={j} style={{ textAlign: "center", minWidth: 92 }}>
                                  {j}
                                </th>
                              ))}
                              <th style={{ minWidth: 110 }}></th>
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
                                        style={{ width: 82, fontSize: 12, padding: "2px 3px" }}
                                      />
                                      <input
                                        type="time"
                                        name={`fin_${po.id}_${q.code}_${j}`}
                                        value={c.fin}
                                        onChange={(e) => set(po.id, q.code, j, "fin", e.target.value)}
                                        style={{ width: 82, fontSize: 12, padding: "2px 3px", marginTop: 2 }}
                                      />
                                    </td>
                                  );
                                })}
                                <td style={{ whiteSpace: "nowrap" }}>
                                  <button
                                    type="button"
                                    className="btn-sm btn-ghost"
                                    onClick={() => copyLundi(po.id, q.code)}
                                    title="Recopier le lundi sur toute la semaine"
                                  >
                                    Lun → sem.
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {lignes.length === 0 && <p className="muted">Aucune ligne active avec des postes.</p>}
    </div>
  );
}
