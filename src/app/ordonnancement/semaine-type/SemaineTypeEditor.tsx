"use client";

import { useState } from "react";
import { defaultQuartActif } from "@/lib/week";

type Quart = { code: string; libelle: string };

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
// iso de reference par jour de semaine (juste pour le fallback defaultQuartActif :
// 2024-01-01 = lundi ... 2024-01-07 = dimanche).
const REF_ISO = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06", "2024-01-07"];

export default function SemaineTypeEditor({
  quarts,
  initial,
}: {
  quarts: Quart[];
  initial: Record<string, boolean>; // `${code}:${jour 0-6}` -> actif
}) {
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const actif = (code: string, j: number) => {
    const k = `${code}:${j}`;
    return k in state ? state[k] : defaultQuartActif(REF_ISO[j], code);
  };

  async function toggle(code: string, j: number) {
    const next = !actif(code, j);
    setState((s) => ({ ...s, [`${code}:${j}`]: next }));
    setSave("saving");
    try {
      const res = await fetch("/api/ordonnancement/semaine-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quart_code: code, jour_semaine: j, value: next }),
      });
      setSave(res.ok ? "saved" : "error");
    } catch {
      setSave("error");
    }
    setTimeout(() => setSave("idle"), 1500);
  }

  return (
    <div className="card section" style={{ overflowX: "auto" }}>
      <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Quarts actifs par jour</h2>
        <span style={{ fontSize: 12, fontWeight: 600, color: save === "error" ? "var(--danger)" : save === "saved" ? "var(--ok)" : "var(--muted)" }}>
          {save === "saving" ? "Enregistrement…" : save === "saved" ? "Enregistré ✓" : save === "error" ? "Échec" : ""}
        </span>
      </div>
      <table className="matrix" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", minWidth: 130 }}>Quart</th>
            {JOURS.map((j, i) => (
              <th key={j} style={{ textAlign: "center", width: 60, color: i === 6 ? "var(--danger)" : undefined }}>
                {j}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quarts.map((q) => (
            <tr key={q.code}>
              <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{q.libelle}</td>
              {JOURS.map((_, j) => {
                const on = actif(q.code, j);
                return (
                  <td key={j} style={{ textAlign: "center", background: on ? undefined : "#fee2e2" }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(q.code, j)}
                      style={{ width: "auto", cursor: "pointer" }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
          {quarts.length === 0 && (
            <tr>
              <td colSpan={8} className="muted">Aucun quart configuré.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 10 }}>
        Ce gabarit définit l&apos;état <strong>par défaut</strong> des quarts quand une semaine n&apos;a pas
        encore été éditée, et sert de référence au bouton <strong>« Réinitialiser »</strong> de chaque
        semaine dans l&apos;ordonnancement. Les lignes (ouvertes/fermées) reviennent, elles, à « tout ouvert ».
      </p>
    </div>
  );
}
