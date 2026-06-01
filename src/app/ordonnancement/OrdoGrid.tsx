"use client";

import { useState } from "react";
import { defaultOpenIso } from "@/lib/week";

type Jour = { iso: string; nom: string; num: string; firstOfWeek: boolean };
type WeekBlock = { num: number; span: number };
type Item = { id: string; label: string };

function ToggleTable({
  type,
  title,
  items,
  days,
  weekBlocks,
  todayIso,
  initial,
  equipeId,
}: {
  type: "ligne" | "equipe";
  title: string;
  items: Item[];
  days: Jour[];
  weekBlocks: WeekBlock[];
  todayIso: string;
  initial: Record<string, boolean>;
  equipeId?: string;
}) {
  // Tout ouvert/actif par defaut SAUF le dimanche.
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [saving, setSaving] = useState(false);

  const key = (id: string, iso: string) => `${id}:${iso}`;
  const val = (id: string, iso: string) => state[key(id, iso)] ?? defaultOpenIso(iso);
  const sep = (d: Jour) => (d.firstOfWeek ? { borderLeft: "3px solid #94a3b8" } : {});

  async function toggle(id: string, iso: string) {
    const k = key(id, iso);
    const next = !val(id, iso);
    setState((s) => ({ ...s, [k]: next }));
    setSaving(true);
    try {
      await fetch("/api/ordonnancement/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, jour: iso, equipe_id: equipeId, value: next }),
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
      <table className="matrix" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th></th>
            {weekBlocks.map((w, i) => (
              <th key={i} colSpan={w.span} style={{ textAlign: "center", borderLeft: "3px solid #94a3b8", background: "#f8fafc" }}>
                Sem {w.num}
              </th>
            ))}
          </tr>
          <tr>
            <th style={{ textAlign: "left" }}>{type === "ligne" ? "Ligne" : "Equipe"}</th>
            {days.map((d) => (
              <th key={d.iso} style={{ textAlign: "center", ...sep(d), background: d.iso === todayIso ? "#dbeafe" : undefined }}>
                {d.nom.slice(0, 1)}
                <br />
                <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>{d.num}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td style={{ whiteSpace: "nowrap" }}>{it.label}</td>
              {days.map((d) => {
                const on = val(it.id, d.iso);
                return (
                  <td key={d.iso} style={{ textAlign: "center", background: on ? undefined : "#fee2e2", ...sep(d) }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(it.id, d.iso)} style={{ width: "auto", cursor: "pointer" }} />
                  </td>
                );
              })}
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
  weekBlocks,
  todayIso,
  equipes,
  lignes,
  equipeState,
  ligneStateByEquipe,
}: {
  days: Jour[];
  weekBlocks: WeekBlock[];
  todayIso: string;
  equipes: Item[];
  lignes: Item[];
  equipeState: Record<string, boolean>;
  ligneStateByEquipe: Record<string, Record<string, boolean>>;
}) {
  return (
    <>
      <ToggleTable
        type="equipe"
        title="Equipes actives par jour"
        items={equipes}
        days={days}
        weekBlocks={weekBlocks}
        todayIso={todayIso}
        initial={equipeState}
      />

      <h2 style={{ marginTop: 24 }}>Lignes ouvertes par equipe</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Tout est ouvert par defaut (dimanche ferme). Decochez ce qui est ferme pour
        chaque equipe.
      </p>
      {equipes.map((e) => (
        <ToggleTable
          key={e.id}
          type="ligne"
          title={e.label}
          items={lignes}
          days={days}
          weekBlocks={weekBlocks}
          todayIso={todayIso}
          initial={ligneStateByEquipe[e.id] ?? {}}
          equipeId={e.id}
        />
      ))}
      {equipes.length === 0 && <p className="muted">Aucune equipe.</p>}
    </>
  );
}
