"use client";

import { useState } from "react";
import { defaultQuartActif } from "@/lib/week";

type Jour = { iso: string; nom: string; num: string; firstOfWeek?: boolean };
type Item = { id: string; label: string };
type Quart = { code: string; libelle: string };

const FIRST_W = 210;
const DAY_W = 40;

export default function OrdoGrid({
  days,
  todayIso,
  currentWeekIsos = [],
  quarts,
  lignes,
  jourQuartState,
  ouvertureState,
}: {
  days: Jour[];
  todayIso: string;
  currentWeekIsos?: string[];
  quarts: Quart[];
  lignes: Item[];
  jourQuartState: Record<string, boolean>;
  ouvertureState: Record<string, boolean>;
}) {
  const [jq, setJq] = useState<Record<string, boolean>>(jourQuartState);
  const [ov, setOv] = useState<Record<string, boolean>>(ouvertureState);
  const [saving, setSaving] = useState(false);

  const quartActif = (code: string, iso: string) => jq[`${code}:${iso}`] ?? defaultQuartActif(iso, code);
  const ligneOuverte = (code: string, lg: string, iso: string) =>
    quartActif(code, iso) ? (ov[`${code}:${lg}:${iso}`] ?? true) : false;

  async function post(body: object) {
    setSaving(true);
    try {
      await fetch("/api/ordonnancement/quart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      setSaving(false);
    }
  }
  function toggleQuart(code: string, iso: string) {
    const next = !quartActif(code, iso);
    setJq((s) => ({ ...s, [`${code}:${iso}`]: next }));
    post({ type: "quart", quart_code: code, jour: iso, value: next });
  }
  function toggleLigne(code: string, lg: string, iso: string) {
    if (!quartActif(code, iso)) return;
    const next = !ligneOuverte(code, lg, iso);
    setOv((s) => ({ ...s, [`${code}:${lg}:${iso}`]: next }));
    post({ type: "ligne", quart_code: code, ligne_id: lg, jour: iso, value: next });
  }

  const sep = (d: Jour) => (d.firstOfWeek ? { borderLeft: "3px solid #94a3b8" } : {});
  const currentSet = new Set(currentWeekIsos);
  const dayBg = (iso: string) =>
    iso === todayIso ? "#dbeafe" : currentSet.has(iso) ? "#eff6ff" : undefined;

  const tableStyle: React.CSSProperties = {
    borderCollapse: "collapse",
    tableLayout: "fixed",
    width: FIRST_W + days.length * DAY_W,
  };

  const Header = ({ label }: { label: string }) => (
    <thead>
      <tr>
        <th style={{ width: FIRST_W, textAlign: "left" }}>{label}</th>
        {days.map((d) => (
          <th key={d.iso} style={{ width: DAY_W, textAlign: "center", ...sep(d), background: dayBg(d.iso) }}>
            {d.nom.slice(0, 2)}
            <br />
            <span className="muted" style={{ fontWeight: 400, fontSize: 10 }}>{d.num}</span>
          </th>
        ))}
      </tr>
    </thead>
  );

  return (
    <>
      <div className="card section" style={{ overflowX: "auto" }}>
        <h2 style={{ marginTop: 0 }}>
          Quarts actifs par jour {saving && <span className="muted" style={{ fontSize: 12 }}>· enregistrement...</span>}
        </h2>
        <table className="matrix" style={tableStyle}>
          <Header label="Quart" />
          <tbody>
            {quarts.map((q) => (
              <tr key={q.code}>
                <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>{q.libelle}</td>
                {days.map((d) => {
                  const on = quartActif(q.code, d.iso);
                  return (
                    <td key={d.iso} style={{ textAlign: "center", background: on ? undefined : "#fee2e2", ...sep(d) }}>
                      <input type="checkbox" checked={on} onChange={() => toggleQuart(q.code, d.iso)} style={{ width: "auto", cursor: "pointer" }} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 24 }}>Lignes ouvertes par quart</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Tout ouvert par defaut. Desactiver un quart (au-dessus) ferme et verrouille
        ses lignes ce jour-la.
      </p>
      {quarts.map((q) => (
        <div key={q.code} className="card section" style={{ overflowX: "auto" }}>
          <h2 style={{ marginTop: 0 }}>{q.libelle}</h2>
          <table className="matrix" style={tableStyle}>
            <Header label="Ligne" />
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.label}</td>
                  {days.map((d) => {
                    const active = quartActif(q.code, d.iso);
                    const on = ligneOuverte(q.code, l.id, d.iso);
                    return (
                      <td key={d.iso} style={{ textAlign: "center", background: on ? undefined : "#fee2e2", ...sep(d) }}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!active}
                          onChange={() => toggleLigne(q.code, l.id, d.iso)}
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
      {quarts.length === 0 && <p className="muted">Aucun quart configure.</p>}
    </>
  );
}
