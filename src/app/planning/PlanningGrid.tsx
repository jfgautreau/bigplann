"use client";

import { useMemo, useState } from "react";

type Jour = { iso: string; nom: string; num: string; firstOfWeek: boolean };
type WeekBlock = { num: number; span: number; year: number; isCurrent: boolean };
type Poste = { id: string; nom: string; niveauMin: number; effectif: number };
type Group = { ligneNom: string; ligneId: string; postes: Poste[] };
type Motif = { id: string; code: string; couleur: string };
type Personne = { id: string; label: string; equipe_id: string | null; editable: boolean };

export default function PlanningGrid({
  days,
  weekBlocks = [],
  todayIso = "",
  personnes = [],
  groups = [],
  openByIso = {},
  motifs = [],
  besoin = [],
  initial = {},
  matrice = {},
}: {
  days: Jour[];
  weekBlocks?: WeekBlock[];
  todayIso?: string;
  personnes?: Personne[];
  groups?: Group[];
  openByIso?: Record<string, string[]>;
  motifs?: Motif[];
  besoin?: number[];
  initial?: Record<string, string>;
  matrice?: Record<string, number>;
}) {
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const key = (pid: string, iso: string) => `${pid}:${iso}`;
  const isPoste = (v: string) => v !== "" && v !== "X" && !v.startsWith("m:");
  const motifColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of motifs) m[`m:${x.id}`] = x.couleur;
    return m;
  }, [motifs]);

  // Index de semaine par colonne (pour le remplissage de semaine)
  const weekIdx = useMemo(() => {
    const arr: number[] = [];
    let w = -1;
    days.forEach((d, i) => {
      if (d.firstOfWeek) w++;
      arr[i] = w;
    });
    return arr;
  }, [days]);

  // Indices de colonnes par bloc-semaine
  const blockDayIndices = useMemo(() => {
    const m: number[][] = [];
    days.forEach((_, i) => {
      (m[weekIdx[i]] ??= []).push(i);
    });
    return m;
  }, [days, weekIdx]);

  const { niveauMin, effectif } = useMemo(() => {
    const nm: Record<string, number> = {};
    const ef: Record<string, number> = {};
    for (const g of groups)
      for (const p of g.postes) {
        nm[p.id] = p.niveauMin;
        ef[p.id] = p.effectif;
      }
    return { niveauMin: nm, effectif: ef };
  }, [groups]);

  const { posteLigne, posteLabel, allLigneIds } = useMemo(() => {
    const pl: Record<string, string> = {};
    const lab: Record<string, string> = {};
    const ids: string[] = [];
    for (const g of groups) {
      ids.push(g.ligneId);
      for (const p of g.postes) {
        pl[p.id] = g.ligneId;
        lab[p.id] = p.nom;
      }
    }
    return { posteLigne: pl, posteLabel: lab, allLigneIds: ids };
  }, [groups]);

  const horsComp = (pid: string, v: string) =>
    isPoste(v) && (matrice[`${pid}:${v}`] ?? 0) < (niveauMin[v] ?? 0);

  const perDay = days.map((d) => {
    const counts: Record<string, number> = {};
    let present = 0;
    let alerts = 0;
    for (const pers of personnes) {
      const v = vals[key(pers.id, d.iso)] ?? "";
      if (isPoste(v)) {
        present++;
        counts[v] = (counts[v] ?? 0) + 1;
        if (horsComp(pers.id, v)) alerts++;
      }
    }
    return { counts, present, alerts };
  });

  async function postCell(pid: string, iso: string, equipe_id: string | null, value: string) {
    const res = await fetch("/api/placement/cell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personne_id: pid, jour: iso, equipe_id, value }),
    });
    if (!res.ok) throw new Error();
  }

  async function change(pid: string, iso: string, equipe_id: string | null, value: string) {
    setVals((s) => ({ ...s, [key(pid, iso)]: value }));
    setSaving("saving");
    try {
      await postCell(pid, iso, equipe_id, value);
      setSaving("saved");
    } catch {
      setSaving("error");
    }
    setTimeout(() => setSaving("idle"), 1200);
  }

  // Recopie la valeur d'une case sur tous les autres jours de la meme semaine.
  async function fillWeek(pers: Personne, dayIndex: number) {
    const value = vals[key(pers.id, days[dayIndex].iso)] ?? "";
    const targets = days.filter((_, j) => j !== dayIndex && weekIdx[j] === weekIdx[dayIndex]);
    const hasExisting = targets.some((t) => (vals[key(pers.id, t.iso)] ?? "") !== "");
    if (hasExisting && !window.confirm("Des affectations existent deja cette semaine pour cette personne. Les ecraser ?")) {
      return;
    }
    setVals((s) => {
      const next = { ...s };
      for (const t of targets) next[key(pers.id, t.iso)] = value;
      return next;
    });
    setSaving("saving");
    try {
      await Promise.all(targets.map((t) => postCell(pers.id, t.iso, pers.equipe_id, value)));
      setSaving("saved");
    } catch {
      setSaving("error");
    }
    setTimeout(() => setSaving("idle"), 1200);
  }

  // Option B : recopie le bloc-semaine precedent (par jour de la semaine) dans le bloc cible.
  async function copyPrevWeek(targetBlock: number) {
    const src = blockDayIndices[targetBlock - 1] ?? [];
    const tgt = blockDayIndices[targetBlock] ?? [];
    if (!src.length || !tgt.length) return;

    const srcByDow: Record<string, number> = {};
    for (const j of src) srcByDow[days[j].nom] = j;

    const existing = personnes.some(
      (p) => p.editable && tgt.some((j) => (vals[key(p.id, days[j].iso)] ?? "") !== "")
    );
    if (existing && !window.confirm("Des affectations existent deja sur cette semaine. Les ecraser avec la semaine precedente ?")) {
      return;
    }

    const updates: { pid: string; iso: string; eq: string | null; value: string }[] = [];
    const next = { ...vals };
    for (const p of personnes) {
      if (!p.editable) continue;
      for (const j of tgt) {
        const s = srcByDow[days[j].nom];
        if (s === undefined) continue;
        const value = vals[key(p.id, days[s].iso)] ?? "";
        next[key(p.id, days[j].iso)] = value;
        updates.push({ pid: p.id, iso: days[j].iso, eq: p.equipe_id, value });
      }
    }
    setVals(next);
    setSaving("saving");
    try {
      await Promise.all(updates.map((u) => postCell(u.pid, u.iso, u.eq, u.value)));
      setSaving("saved");
    } catch {
      setSaving("error");
    }
    setTimeout(() => setSaving("idle"), 1200);
  }

  const deltaColor = (d: number) => (d < 0 ? "var(--danger)" : d > 0 ? "#9a3412" : "var(--ok)");
  const sep = (d: Jour): React.CSSProperties => (d.firstOfWeek ? { borderLeft: "3px solid #94a3b8" } : {});
  const isToday = (d: Jour) => d.iso === todayIso;

  return (
    <div className="card" style={{ overflowX: "auto", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 12,
          fontSize: 12,
          fontWeight: 600,
          color: saving === "error" ? "var(--danger)" : saving === "saved" ? "var(--ok)" : "var(--muted)",
        }}
      >
        {saving === "saving" ? "Enregistrement..." : saving === "saved" ? "Enregistre" : saving === "error" ? "Echec" : ""}
      </div>

      <table className="matrix" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ position: "sticky", left: 0, background: "#fff", textAlign: "left" }}>
              Personne
            </th>
            {weekBlocks.map((w, i) => (
              <th
                key={i}
                colSpan={w.span}
                style={{
                  textAlign: "center",
                  borderLeft: "3px solid #94a3b8",
                  background: w.isCurrent ? "#dbeafe" : "#f8fafc",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: w.isCurrent ? 700 : undefined }}>
                  {w.year} · Semaine {w.num}
                  {w.isCurrent && <span className="muted" style={{ fontWeight: 400 }}>(en cours)</span>}
                  {i >= 1 && (
                    <button
                      type="button"
                      className="btn-sm btn-ghost"
                      style={{ padding: "2px 6px", fontSize: 11 }}
                      onClick={() => copyPrevWeek(i)}
                      title="Recopier la semaine precedente dans celle-ci"
                    >
                      &larr; S-1
                    </button>
                  )}
                </span>
              </th>
            ))}
          </tr>
          <tr>
            {days.map((d) => (
              <th key={d.iso} style={{ textAlign: "center", minWidth: 58, ...sep(d), background: isToday(d) ? "#dbeafe" : undefined }}>
                {d.nom.slice(0, 2)}
                <br />
                <span className="muted" style={{ fontWeight: 400 }}>{d.num}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["Besoin", (i: number) => `${besoin[i] ?? 0}`, () => "var(--muted)"],
              ["Present", (i: number) => `${perDay[i].present}`, () => "var(--text)"],
              [
                "Delta",
                (i: number) => {
                  const d = perDay[i].present - (besoin[i] ?? 0);
                  return d > 0 ? `+${d}` : `${d}`;
                },
                (i: number) => deltaColor(perDay[i].present - (besoin[i] ?? 0)),
              ],
              ["Alertes", (i: number) => `${perDay[i].alerts}`, (i: number) => (perDay[i].alerts > 0 ? "var(--danger)" : "var(--muted)")],
            ] as [string, (i: number) => string, (i: number) => string][]
          ).map(([label, get, color]) => (
            <tr key={label} style={{ background: "#f8fafc" }}>
              <td style={{ position: "sticky", left: 0, background: "#f8fafc", fontWeight: 600 }}>{label}</td>
              {days.map((d, i) => (
                <td key={d.iso} style={{ textAlign: "center", fontWeight: 700, color: color(i), ...sep(d), background: isToday(d) ? "#eef2ff" : undefined }}>
                  {get(i)}
                </td>
              ))}
            </tr>
          ))}

          {personnes.map((pers) => (
            <tr key={pers.id}>
              <td style={{ position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>
                {pers.label}
                {!pers.editable && <span className="muted"> (lecture)</span>}
              </td>
              {days.map((d, i) => {
                const v = vals[key(pers.id, d.iso)] ?? "";
                const alert = horsComp(pers.id, v);
                const over = isPoste(v) && (perDay[i].counts[v] ?? 0) > (effectif[v] ?? 0);
                const openSet = new Set(openByIso[d.iso] ?? allLigneIds);
                const closedCurrent = isPoste(v) && !openSet.has(posteLigne[v] ?? "");
                const showFill = pers.editable && v !== "";
                return (
                  <td
                    key={d.iso}
                    className="pcell"
                    style={{
                      textAlign: "center",
                      background: alert ? "#fee2e2" : motifColor[v] ? motifColor[v] : isToday(d) ? "#eff6ff" : undefined,
                      outline: over ? "2px solid #f97316" : undefined,
                      outlineOffset: -2,
                      padding: 2,
                      position: "relative",
                      ...sep(d),
                    }}
                    title={[alert ? "Hors competence" : "", over ? "Sur-effectif" : ""].filter(Boolean).join(" · ") || undefined}
                  >
                    <select
                      className="flat"
                      value={v}
                      disabled={!pers.editable}
                      onChange={(e) => change(pers.id, d.iso, pers.equipe_id, e.target.value)}
                      style={{ width: "100%", fontSize: 12, padding: "3px 1px" }}
                    >
                      <option value="">—</option>
                      <option value="X">NT</option>
                      {closedCurrent && (
                        <option value={v}>{posteLabel[v] ?? "?"} (ligne fermee)</option>
                      )}
                      {groups
                        .filter((g) => openSet.has(g.ligneId))
                        .map((g) => (
                          <optgroup key={g.ligneNom} label={g.ligneNom}>
                            {g.postes.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nom}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      {motifs.length > 0 && (
                        <optgroup label="Absences">
                          {motifs.map((mo) => (
                            <option key={mo.id} value={`m:${mo.id}`}>
                              {mo.code}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {showFill && (
                      <button
                        type="button"
                        className="fillw"
                        title="Remplir toute la semaine avec cette valeur"
                        onClick={() => fillWeek(pers, i)}
                      >
                        &raquo;
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {personnes.length === 0 && (
            <tr>
              <td colSpan={days.length + 1} className="muted">Aucune personne (choisissez une equipe).</td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="muted" style={{ marginTop: 10 }}>
        Survolez une case remplie et cliquez sur &raquo; pour recopier la valeur sur toute
        la semaine. Rouge = hors competence · contour orange = sur-effectif · jours sans
        ligne ouverte masques.
      </p>
    </div>
  );
}
