"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Jour = { iso: string; nom: string; num: string };
type Item = { id: string; label: string };

function ToggleTable({
  type,
  title,
  items,
  days,
  initial,
  equipeId,
}: {
  type: "ligne" | "equipe";
  title: string;
  items: Item[];
  days: Jour[];
  initial: Record<string, boolean>;
  equipeId?: string;
}) {
  // Tout est OUVERT / ACTIF par defaut : on decoche ce qui est ferme.
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [saving, setSaving] = useState(false);

  const key = (id: string, iso: string) => `${id}:${iso}`;
  const val = (id: string, iso: string) => state[key(id, iso)] ?? true;

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
        {title}{" "}
        {saving && <span className="muted" style={{ fontSize: 12 }}>· enregistrement...</span>}
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
              {days.map((d) => {
                const on = val(it.id, d.iso);
                return (
                  <td
                    key={d.iso}
                    style={{ textAlign: "center", background: on ? undefined : "#fee2e2" }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(it.id, d.iso)}
                      style={{ width: "auto", cursor: "pointer" }}
                    />
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
      <p className="muted" style={{ marginTop: 6 }}>
        Coche = {type === "ligne" ? "ligne ouverte" : "equipe active"}. Decochez ce
        qui est ferme (fond rouge).
      </p>
    </div>
  );
}

export default function OrdoGrid({
  days,
  equipes,
  equipeState,
  lignes,
  ligneState,
  selectedEquipe,
  semaine,
}: {
  days: Jour[];
  equipes: Item[];
  equipeState: Record<string, boolean>;
  lignes: Item[];
  ligneState: Record<string, boolean>;
  selectedEquipe: string;
  semaine: string;
}) {
  const router = useRouter();
  const equipeNom = equipes.find((e) => e.id === selectedEquipe)?.label;

  function selectEquipe(id: string) {
    const p = new URLSearchParams();
    if (id) p.set("equipe", id);
    if (semaine) p.set("semaine", semaine);
    router.push(`/ordonnancement?${p.toString()}`);
  }

  return (
    <>
      <ToggleTable
        type="equipe"
        title="Equipes actives par jour"
        items={equipes}
        days={days}
        initial={equipeState}
      />

      <div className="card section">
        <h2 style={{ marginTop: 0 }}>Lignes ouvertes par equipe</h2>
        <div className="field" style={{ maxWidth: 320 }}>
          <span>Equipe a configurer</span>
          <select value={selectedEquipe} onChange={(e) => selectEquipe(e.target.value)}>
            <option value="">Choisir une equipe...</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedEquipe ? (
        <ToggleTable
          type="ligne"
          title={`Lignes ouvertes - ${equipeNom ?? ""}`}
          items={lignes}
          days={days}
          initial={ligneState}
          equipeId={selectedEquipe}
        />
      ) : (
        <p className="muted">
          Choisissez une equipe pour ouvrir/fermer ses lignes (utile pour fermer une
          ligne sur une seule equipe).
        </p>
      )}
    </>
  );
}
