"use client";

import { useState } from "react";

type Jour = { iso: string; nom: string; num: string };
type Item = { id: string; label: string };

function ToggleTable({
  type,
  title,
  items,
  days,
  initial,
  defaultOn,
}: {
  type: "ligne" | "equipe";
  title: string;
  items: Item[];
  days: Jour[];
  initial: Record<string, boolean>;
  defaultOn: boolean;
}) {
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [saving, setSaving] = useState(false);

  const key = (id: string, iso: string) => `${id}:${iso}`;
  const val = (id: string, iso: string) => state[key(id, iso)] ?? defaultOn;

  async function toggle(id: string, iso: string) {
    const k = key(id, iso);
    const next = !val(id, iso);
    setState((s) => ({ ...s, [k]: next }));
    setSaving(true);
    try {
      await fetch("/api/ordonnancement/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, jour: iso, value: next }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card section" style={{ overflowX: "auto" }}>
      <h2 style={{ marginTop: 0 }}>
        {title} {saving && <span className="muted" style={{ fontSize: 12 }}>· enregistrement...</span>}
      </h2>
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>{type === "ligne" ? "Ligne" : "Equipe"}</th>
            {days.map((d) => (
              <th key={d.iso} style={{ textAlign: "center" }}>
                {d.nom.slice(0, 3)}
                <br />
                <span className="muted" style={{ fontWeight: 400 }}>{d.num}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td style={{ whiteSpace: "nowrap" }}>{it.label}</td>
              {days.map((d) => (
                <td key={d.iso} style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={val(it.id, d.iso)}
                    onChange={() => toggle(it.id, d.iso)}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                </td>
              ))}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={days.length + 1} className="muted">Aucun element.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function OrdoGrid({
  days,
  lignes,
  equipes,
  ligneState,
  equipeState,
}: {
  days: Jour[];
  lignes: Item[];
  equipes: Item[];
  ligneState: Record<string, boolean>;
  equipeState: Record<string, boolean>;
}) {
  return (
    <>
      <ToggleTable
        type="ligne"
        title="Lignes ouvertes par jour"
        items={lignes}
        days={days}
        initial={ligneState}
        defaultOn={false}
      />
      <ToggleTable
        type="equipe"
        title="Equipes actives par jour (ex. nuit)"
        items={equipes}
        days={days}
        initial={equipeState}
        defaultOn={false}
      />
    </>
  );
}
