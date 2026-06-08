"use client";

import { useState } from "react";
import { typeQuartActif, type SemaineType, type SemaineOuverture } from "@/lib/semaine-type";
import { dowMon } from "@/lib/week";

type Jour = { iso: string; nom: string; num: string; firstOfWeek?: boolean };
type Item = { id: string; label: string };
type Quart = { code: string; libelle: string };
type WeekBlock = { num: number; year: number; span: number };

const FIRST_W = 150;
const DAY_W = 34;

export default function OrdoGrid({
  days,
  weekBlocks = [],
  todayIso,
  currentWeekIsos = [],
  quarts,
  linesByQuart,
  jourQuartState,
  ouvertureState,
  semaineType = {},
  semaineOuverture = {},
}: {
  days: Jour[];
  weekBlocks?: WeekBlock[];
  todayIso: string;
  currentWeekIsos?: string[];
  quarts: Quart[];
  linesByQuart: Record<string, Item[]>;
  jourQuartState: Record<string, boolean>;
  ouvertureState: Record<string, boolean>;
  semaineType?: SemaineType;
  semaineOuverture?: SemaineOuverture;
}) {
  const [jq, setJq] = useState<Record<string, boolean>>(jourQuartState);
  const [ov, setOv] = useState<Record<string, boolean>>(ouvertureState);
  const [saving, setSaving] = useState(false);

  // Plus de remplissage par defaut : un jour sans ligne explicite est FERME.
  // La semaine type ne s'applique qu'a l'initialisation (bouton), donc modifier
  // la semaine type ensuite n'est pas retroactif sur les semaines deja initialisees.
  const quartActif = (code: string, iso: string) => jq[`${code}:${iso}`] ?? false;

  // Un jour est "initialise" s'il porte au moins une ligne jour_quart explicite.
  const dayInitialized = (iso: string) => quarts.some((q) => `${q.code}:${iso}` in jq);

  // ISO de chaque bloc-semaine (pour le bouton "Initialiser").
  const blockIsos: string[][] = [];
  {
    let idx = 0;
    for (const w of weekBlocks) {
      blockIsos.push(days.slice(idx, idx + w.span).map((d) => d.iso));
      idx += w.span;
    }
  }

  async function resetWeek(isos: string[]) {
    if (!isos.length) return;
    const dejaInit = isos.some((iso) => dayInitialized(iso));
    if (dejaInit && !window.confirm("Cette semaine est déjà initialisée. L'écraser avec la semaine type actuelle ?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ordonnancement/reset-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isos }),
      });
      if (res.ok) {
        // Mise a jour immediate : on ecrit l'instantané (snapshot) de la semaine
        // type dans l'etat local, comme le serveur vient de le faire en base.
        const set = new Set(isos);
        setJq((s) => {
          const n = { ...s };
          for (const iso of isos) for (const q of quarts) n[`${q.code}:${iso}`] = typeQuartActif(semaineType, iso, q.code);
          return n;
        });
        setOv((s) => {
          const n = { ...s };
          for (const k of Object.keys(n)) if (set.has(k.slice(-10))) delete n[k]; // efface les surcharges de la semaine
          for (const iso of isos) {
            const dow = dowMon(iso);
            for (const [key, ouverte] of Object.entries(semaineOuverture)) {
              if (ouverte) continue; // ouvert = defaut (absence)
              const [qc, lg, j] = key.split(":");
              if (Number(j) === dow) n[`${qc}:${lg}:${iso}`] = false;
            }
          }
          return n;
        });
      }
    } finally {
      setSaving(false);
    }
  }
  // Apres initialisation : ligne ouverte par defaut (absence) tant que le quart
  // est actif ; les fermetures explicites portent une ligne ouverture_quart=false.
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

  const sep = (d: Jour) => (d.firstOfWeek ? { borderLeft: "2px solid #cbd5e1" } : {});
  const currentSet = new Set(currentWeekIsos);
  const currentBlockIdx = blockIsos.findIndex((isos) => isos.some((iso) => currentSet.has(iso)));
  const dayBg = (iso: string) =>
    iso === todayIso ? "#dbeafe" : currentSet.has(iso) ? "#eff6ff" : undefined;

  const tableStyle: React.CSSProperties = {
    borderCollapse: "collapse",
    tableLayout: "fixed",
    width: FIRST_W + days.length * DAY_W,
  };

  const Header = ({ label, showReset = false }: { label: string; showReset?: boolean }) => (
    <thead>
      {weekBlocks.length > 0 && (
        <tr>
          <th style={{ width: FIRST_W }}></th>
          {weekBlocks.map((w, i) => {
            const isCurrent = i === currentBlockIdx;
            return (
            <th
              key={i}
              colSpan={w.span}
              style={{
                textAlign: "center",
                fontSize: 12,
                borderLeft: "2px solid #cbd5e1",
                background: isCurrent ? "#dbeafe" : "#f8fafc",
                fontWeight: isCurrent ? 700 : undefined,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {w.year} · S{w.num}
                {isCurrent && <span className="muted" style={{ fontWeight: 400 }}>(en cours)</span>}
                {showReset && (
                  <button
                    type="button"
                    className="btn-sm btn-ghost"
                    onClick={() => resetWeek(blockIsos[i] ?? [])}
                    title="Initialiser cette semaine avec la semaine type (ré-applique / écrase si déjà fait)"
                    style={{ padding: "1px 6px", fontSize: 12, lineHeight: 1.2 }}
                  >
                    ⚙️ Initialiser
                  </button>
                )}
              </span>
            </th>
            );
          })}
        </tr>
      )}
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
          Quarts actifs par jour {saving && <span className="muted" style={{ fontSize: 12 }}>· enregistrement…</span>}
        </h2>
        <table className="matrix" style={tableStyle}>
          <Header label="Quart" showReset />
          <tbody>
            {quarts.map((q) => (
              <tr key={q.code}>
                <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>{q.libelle}</td>
                {days.map((d) => {
                  const on = quartActif(q.code, d.iso);
                  const init = dayInitialized(d.iso);
                  return (
                    <td key={d.iso} style={{ textAlign: "center", background: on ? undefined : init ? "#fee2e2" : "#f1f5f9", ...sep(d) }}>
                      <input type="checkbox" checked={on} onChange={() => toggleQuart(q.code, d.iso)} style={{ width: "auto", cursor: "pointer" }} title={init ? undefined : "Semaine non initialisée"} />
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
        Rien n&apos;est rempli par défaut : utilisez <strong>« ⚙️ Initialiser »</strong> en haut d&apos;une semaine
        pour appliquer la semaine type. Une fois initialisée, désactiver un quart ferme et verrouille ses lignes ce jour-là.
        Modifier la semaine type ensuite n&apos;affecte pas les semaines déjà initialisées (ré-initialisez pour écraser).
      </p>
      {quarts.map((q) => {
        const qLignes = linesByQuart[q.code] ?? [];
        return (
          <div key={q.code} className="card section" style={{ overflowX: "auto" }}>
            <h2 style={{ marginTop: 0 }}>{q.libelle}</h2>
            <table className="matrix" style={tableStyle}>
              <Header label="Ligne" />
              <tbody>
                {qLignes.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.label}</td>
                    {days.map((d) => {
                      const active = quartActif(q.code, d.iso);
                      const on = ligneOuverte(q.code, l.id, d.iso);
                      return (
                        <td key={d.iso} style={{ textAlign: "center", background: !active ? "#f1f5f9" : on ? undefined : "#fee2e2", ...sep(d) }}>
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
                {qLignes.length === 0 && (
                  <tr>
                    <td colSpan={days.length + 1} className="muted">Aucune ligne activée sur ce quart (référentiel).</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
      {quarts.length === 0 && <p className="muted">Aucun quart configuré.</p>}
    </>
  );
}
