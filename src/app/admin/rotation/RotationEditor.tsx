"use client";

import { useState } from "react";

type Week = { iso: string; num: number; label: string };
type Equipe = { id: string; label: string };

const OPTIONS: [string, string][] = [
  ["", "—"],
  ["journee", "Journée"],
  ["matin", "Matin"],
  ["apres_midi", "Après-midi"],
  ["nuit", "Nuit"],
];

export default function RotationEditor({
  weeks,
  equipes,
  initial,
}: {
  weeks: Week[];
  equipes: Equipe[];
  initial: Record<string, string>; // `${equipe}|${semaine}` -> quart
}) {
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const key = (eq: string, iso: string) => `cell|${eq}|${iso}`;

  async function saveRotation() {
    const cells = weeks.flatMap((w) => equipes.map((e) => ({ equipe_id: e.id, semaine: w.iso, quart_code: vals[key(e.id, w.iso)] ?? "" })));
    setSave("saving");
    try {
      const res = await fetch("/api/ordonnancement/rotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells }),
      });
      setSave(res.ok ? "saved" : "error");
    } catch {
      setSave("error");
    }
    setTimeout(() => setSave("idle"), 2000);
  }

  // Pre-remplissage : nuit pour les equipes "nuit", alternance Matin/AM pour les autres.
  function prefill() {
    const nonNuit = equipes.filter((e) => !/nuit/i.test(e.label));
    const next: Record<string, string> = { ...vals };
    for (const w of weeks) {
      for (const e of equipes) {
        if (/nuit/i.test(e.label)) {
          next[key(e.id, w.iso)] = "nuit";
        } else {
          const j = nonNuit.findIndex((x) => x.id === e.id);
          next[key(e.id, w.iso)] = (w.num + j) % 2 === 0 ? "matin" : "apres_midi";
        }
      }
    }
    setVals(next);
  }

  const saveLabel = save === "saving" ? "Enregistrement…" : save === "saved" ? "Enregistré ✓" : save === "error" ? "Échec" : "";
  const saveColor = save === "error" ? "var(--danger)" : save === "saved" ? "var(--ok)" : "var(--muted)";

  return (
    <div>
      <button type="button" className="btn-sm btn-ghost" onClick={prefill} style={{ marginBottom: 10 }}>
        Pré-remplir (alternance A/B)
      </button>
      <div style={{ overflowX: "auto" }}>
        <table className="matrix" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Semaine</th>
              {equipes.map((e) => (
                <th key={e.id} style={{ textAlign: "center", minWidth: 110 }}>{e.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.iso}>
                <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{w.label}</td>
                {equipes.map((e) => {
                  const k = key(e.id, w.iso);
                  return (
                    <td key={e.id} style={{ textAlign: "center" }}>
                      <select
                        name={k}
                        value={vals[k] ?? ""}
                        onChange={(ev) => setVals((s) => ({ ...s, [k]: ev.target.value }))}
                      >
                        {OPTIONS.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
        <button type="button" onClick={saveRotation} disabled={save === "saving"} style={{ width: "auto", padding: "9px 20px" }}>
          Enregistrer la rotation
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: saveColor }}>{saveLabel}</span>
      </div>
    </div>
  );
}
