"use client";

import { useMemo, useState } from "react";

type Jour = { iso: string; nom: string; num: string };
type Poste = { id: string; nom: string; niveauMin: number };
type Group = { ligneNom: string; postes: Poste[] };
type Personne = { id: string; label: string; equipe_id: string | null; editable: boolean };

export default function PlanningGrid({
  days,
  personnes = [],
  groups = [],
  besoin = [],
  initial = {},
  matrice = {},
}: {
  days: Jour[];
  personnes?: Personne[];
  groups?: Group[];
  besoin?: number[];
  initial?: Record<string, string>;
  matrice?: Record<string, number>;
}) {
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const key = (pid: string, iso: string) => `${pid}:${iso}`;

  const niveauMin = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of groups) for (const p of g.postes) m[p.id] = p.niveauMin;
    return m;
  }, [groups]);

  const isPoste = (v: string) => v !== "" && v !== "X";
  const horsComp = (pid: string, v: string) =>
    isPoste(v) && (matrice[`${pid}:${v}`] ?? 0) < (niveauMin[v] ?? 0);

  // Indicateurs par jour (sur les personnes affichees)
  const stats = days.map((d, i) => {
    let present = 0;
    let alerts = 0;
    for (const pers of personnes) {
      const v = vals[key(pers.id, d.iso)] ?? "";
      if (isPoste(v)) {
        present++;
        if (horsComp(pers.id, v)) alerts++;
      }
    }
    const bes = besoin[i] ?? 0;
    return { present, alerts, besoin: bes, delta: present - bes };
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

  const deltaColor = (d: number) =>
    d < 0 ? "var(--danger)" : d > 0 ? "#9a3412" : "var(--ok)";

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
            <th style={{ position: "sticky", left: 0, background: "#fff", textAlign: "left" }}>Personne</th>
            {days.map((d) => (
              <th key={d.iso} style={{ textAlign: "center", minWidth: 130 }}>
                {d.nom}
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
              ["Besoin", (s: (typeof stats)[number]) => `${s.besoin}`, () => "var(--muted)"],
              ["Present", (s: (typeof stats)[number]) => `${s.present}`, () => "var(--text)"],
              ["Delta", (s: (typeof stats)[number]) => (s.delta > 0 ? `+${s.delta}` : `${s.delta}`), (s: (typeof stats)[number]) => deltaColor(s.delta)],
              ["Alertes", (s: (typeof stats)[number]) => `${s.alerts}`, (s: (typeof stats)[number]) => (s.alerts > 0 ? "var(--danger)" : "var(--muted)")],
            ] as [string, (s: (typeof stats)[number]) => string, (s: (typeof stats)[number]) => string][]
          ).map(([label, get, color]) => (
            <tr key={label} style={{ background: "#f8fafc" }}>
              <td style={{ position: "sticky", left: 0, background: "#f8fafc", fontWeight: 600 }}>{label}</td>
              {stats.map((s, i) => (
                <td key={i} style={{ textAlign: "center", fontWeight: 700, color: color(s) }}>
                  {get(s)}
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
              {days.map((d) => {
                const v = vals[key(pers.id, d.iso)] ?? "";
                const alert = horsComp(pers.id, v);
                return (
                  <td
                    key={d.iso}
                    style={{ textAlign: "center", background: alert ? "#fee2e2" : undefined, padding: 3 }}
                    title={alert ? "Placement hors competence (niveau actuel insuffisant)" : undefined}
                  >
                    <select
                      value={v}
                      disabled={!pers.editable}
                      onChange={(e) => change(pers.id, d.iso, pers.equipe_id, e.target.value)}
                      style={{ width: "100%", fontSize: 12, padding: "4px 2px" }}
                    >
                      <option value="">—</option>
                      <option value="X">Absent / NT</option>
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
        Besoin = effectif requis des lignes ouvertes (abaque). Present/Delta/Alertes
        portent sur les personnes affichees. Cellule rouge = placement hors competence.
      </p>
    </div>
  );
}
