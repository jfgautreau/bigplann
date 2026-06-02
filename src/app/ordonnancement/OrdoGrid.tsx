"use client";

import { useState } from "react";
import { defaultOpenIso } from "@/lib/week";

type Jour = { iso: string; nom: string; num: string; firstOfWeek?: boolean };
type WeekBlock = { num: number; span: number };
type Item = { id: string; label: string };

const FIRST_W = 210;
const DAY_W = 40;

export default function OrdoGrid({
  days,
  weekBlocks = [],
  todayIso,
  currentWeekIsos = [],
  equipes,
  lignes,
  equipeState,
  ligneStateByEquipe,
}: {
  days: Jour[];
  weekBlocks?: WeekBlock[];
  todayIso: string;
  currentWeekIsos?: string[];
  equipes: Item[];
  lignes: Item[];
  equipeState: Record<string, boolean>;
  ligneStateByEquipe: Record<string, Record<string, boolean>>;
}) {
  // Etats centralises
  const [eqState, setEqState] = useState<Record<string, boolean>>(equipeState);
  const [lgState, setLgState] = useState<Record<string, boolean>>(() => {
    const flat: Record<string, boolean> = {};
    for (const [eq, m] of Object.entries(ligneStateByEquipe))
      for (const [k, v] of Object.entries(m)) flat[`${eq}:${k}`] = v;
    return flat;
  });
  const [saving, setSaving] = useState(false);

  const eqVal = (eq: string, iso: string) => eqState[`${eq}:${iso}`] ?? defaultOpenIso(iso);
  const lgVal = (eq: string, lg: string, iso: string) =>
    lgState[`${eq}:${lg}:${iso}`] ?? defaultOpenIso(iso);

  async function post(body: object) {
    setSaving(true);
    try {
      await fetch("/api/ordonnancement/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleEquipe(eq: string, iso: string) {
    const next = !eqVal(eq, iso);
    setEqState((s) => ({ ...s, [`${eq}:${iso}`]: next }));
    post({ type: "equipe", id: eq, jour: iso, value: next });
  }
  function toggleLigne(eq: string, lg: string, iso: string) {
    if (!eqVal(eq, iso)) return; // equipe inactive -> lignes verrouillees
    const next = !lgVal(eq, lg, iso);
    setLgState((s) => ({ ...s, [`${eq}:${lg}:${iso}`]: next }));
    post({ type: "ligne", id: lg, jour: iso, equipe_id: eq, value: next });
  }

  const sep = (d: Jour) => (d.firstOfWeek ? { borderLeft: "3px solid #94a3b8" } : {});
  const currentSet = new Set(currentWeekIsos);
  const dayBg = (iso: string) =>
    iso === todayIso ? "#dbeafe" : currentSet.has(iso) ? "#eff6ff" : undefined;

  const Header = ({ label }: { label: string }) => (
    <thead>
      {weekBlocks.length > 0 && (
        <tr>
          <th style={{ width: FIRST_W }}></th>
          {weekBlocks.map((w, i) => (
            <th key={i} colSpan={w.span} style={{ textAlign: "center", borderLeft: "3px solid #94a3b8", background: "#f8fafc" }}>
              Sem {w.num}
            </th>
          ))}
        </tr>
      )}
      <tr>
        <th style={{ width: FIRST_W, textAlign: "left" }}>{label}</th>
        {days.map((d) => (
          <th key={d.iso} style={{ width: DAY_W, textAlign: "center", ...sep(d), background: dayBg(d.iso) }}>
            {d.nom.slice(0, 3)}
            <br />
            <span className="muted" style={{ fontWeight: 400, fontSize: 10 }}>{d.num}</span>
          </th>
        ))}
      </tr>
    </thead>
  );

  const tableStyle: React.CSSProperties = {
    borderCollapse: "collapse",
    tableLayout: "fixed",
    width: FIRST_W + days.length * DAY_W,
  };

  return (
    <>
      <div className="card section" style={{ overflowX: "auto" }}>
        <h2 style={{ marginTop: 0 }}>
          Equipes actives par jour {saving && <span className="muted" style={{ fontSize: 12 }}>· enregistrement...</span>}
        </h2>
        <table className="matrix" style={tableStyle}>
          <Header label="Equipe" />
          <tbody>
            {equipes.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.label}</td>
                {days.map((d) => {
                  const on = eqVal(e.id, d.iso);
                  return (
                    <td key={d.iso} style={{ textAlign: "center", background: on ? undefined : "#fee2e2", ...sep(d) }}>
                      <input type="checkbox" checked={on} onChange={() => toggleEquipe(e.id, d.iso)} style={{ width: "auto", cursor: "pointer" }} />
                    </td>
                  );
                })}
              </tr>
            ))}
            {equipes.length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="muted">Aucune equipe.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 24 }}>Lignes ouvertes par equipe</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Tout ouvert par defaut (dimanche ferme). Desactiver une equipe ci-dessus
        verrouille et ferme ses lignes le jour concerne.
      </p>
      {equipes.map((e) => (
        <div key={e.id} className="card section" style={{ overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>{e.label}</h2>
          <table className="matrix" style={tableStyle}>
            <Header label="Ligne" />
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.label}</td>
                  {days.map((d) => {
                    const active = eqVal(e.id, d.iso);
                    const on = active && lgVal(e.id, l.id, d.iso);
                    return (
                      <td key={d.iso} style={{ textAlign: "center", background: on ? undefined : "#fee2e2", ...sep(d) }}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!active}
                          onChange={() => toggleLigne(e.id, l.id, d.iso)}
                          style={{ width: "auto", cursor: active ? "pointer" : "not-allowed" }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={days.length + 1} className="muted">Aucune ligne.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
