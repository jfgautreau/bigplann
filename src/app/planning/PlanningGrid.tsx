"use client";

import { useMemo, useState } from "react";

type Jour = { iso: string; nom: string; num: string; firstOfWeek: boolean };
type WeekHead = { label: string };
type Poste = { id: string; nom: string; niveauMin: number; effectif: number };
type Group = { ligneNom: string; postes: Poste[] };
type Personne = { id: string; label: string; equipe_id: string | null; editable: boolean };

export default function PlanningGrid({
  days,
  weeks = [],
  todayIso = "",
  personnes = [],
  groups = [],
  besoin = [],
  initial = {},
  matrice = {},
}: {
  days: Jour[];
  weeks?: WeekHead[];
  todayIso?: string;
  personnes?: Personne[];
  groups?: Group[];
  besoin?: number[];
  initial?: Record<string, string>;
  matrice?: Record<string, number>;
}) {
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const key = (pid: string, iso: string) => `${pid}:${iso}`;
  const isPoste = (v: string) => v !== "" && v !== "X";

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

  const horsComp = (pid: string, v: string) =>
    isPoste(v) && (matrice[`${pid}:${v}`] ?? 0) < (niveauMin[v] ?? 0);

  // Comptage par jour et par poste (pour le sur-effectif) + indicateurs.
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

  async function change(pid: string, iso: string, equipe_id: string | null, value: string) {
    setVals((s) => ({ ...s, [key(pid, iso)]: value }));
    setSaving("saving");
    try {
      const res = await fetch("/api/placement/cell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personne_id: pid, jour: iso, equipe_id, value }),
      });
      setSaving(res.ok ? "saved" : "error");
    } catch {
      setSaving("error");
    }
    setTimeout(() => setSaving("idle"), 1200);
  }

  const deltaColor = (d: number) => (d < 0 ? "var(--danger)" : d > 0 ? "#9a3412" : "var(--ok)");
  const sep = (d: Jour): React.CSSProperties =>
    d.firstOfWeek ? { borderLeft: "3px solid #94a3b8" } : {};
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
          {weeks.length > 0 && (
            <tr>
              <th style={{ position: "sticky", left: 0, background: "#fff" }}></th>
              {weeks.map((w, i) => (
                <th
                  key={i}
                  colSpan={7}
                  style={{ textAlign: "center", borderLeft: "3px solid #94a3b8", background: "#f8fafc" }}
                >
                  {w.label}
                </th>
              ))}
            </tr>
          )}
          <tr>
            <th style={{ position: "sticky", left: 0, background: "#fff", textAlign: "left" }}>Personne</th>
            {days.map((d) => (
              <th
                key={d.iso}
                style={{
                  textAlign: "center",
                  minWidth: 60,
                  ...sep(d),
                  background: isToday(d) ? "#dbeafe" : undefined,
                }}
              >
                {d.nom.slice(0, 3)}
                <br />
                <span className="muted" style={{ fontWeight: 400 }}>{d.num}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Indicateurs */}
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
                <td
                  key={d.iso}
                  style={{
                    textAlign: "center",
                    fontWeight: 700,
                    color: color(i),
                    ...sep(d),
                    background: isToday(d) ? "#eef2ff" : undefined,
                  }}
                >
                  {get(i)}
                </td>
              ))}
            </tr>
          ))}

          {/* Personnes */}
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
                return (
                  <td
                    key={d.iso}
                    style={{
                      textAlign: "center",
                      background: alert ? "#fee2e2" : isToday(d) ? "#eff6ff" : undefined,
                      outline: over ? "2px solid #f97316" : undefined,
                      outlineOffset: -2,
                      padding: 3,
                      ...sep(d),
                    }}
                    title={
                      [
                        alert ? "Hors competence (niveau actuel insuffisant)" : "",
                        over ? "Sur-effectif : depasse l'effectif de l'abaque" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                  >
                    <select
                      value={v}
                      disabled={!pers.editable}
                      onChange={(e) => change(pers.id, d.iso, pers.equipe_id, e.target.value)}
                      style={{ width: "100%", fontSize: 12, padding: "3px 1px" }}
                    >
                      <option value="">—</option>
                      <option value="X">Abs/NT</option>
                      {groups.map((g) => (
                        <optgroup key={g.ligneNom} label={g.ligneNom}>
                          {g.postes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nom}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
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
        Besoin = effectif des lignes ouvertes (abaque). Cellule rouge = hors competence ·
        contour orange = sur-effectif (depasse l&apos;effectif du poste).
      </p>
    </div>
  );
}
