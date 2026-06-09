"use client";

import { useState } from "react";

const JOURS = [
  { dow: 1, label: "Lundi" },
  { dow: 2, label: "Mardi" },
  { dow: 3, label: "Mercredi" },
  { dow: 4, label: "Jeudi" },
  { dow: 5, label: "Vendredi" },
  { dow: 6, label: "Samedi" },
  { dow: 7, label: "Dimanche" },
];

type TpConfig = {
  off?: Record<string, string[]>;
  horaires?: Record<string, { debut: string; fin: string }>;
};
type Pers = { id: string; label: string; temps_partiel: boolean; tp_type: string | null; tp_config: TpConfig | null };

export default function TempsPartielModal({
  personne,
  onClose,
  onSaved,
}: {
  personne: Pers;
  onClose: () => void;
  onSaved: (p: { temps_partiel: boolean; tp_type: string | null; tp_config: TpConfig | null }) => void;
}) {
  const cfg = personne.tp_config ?? {};
  const [type, setType] = useState<"JOURS" | "HORAIRES">(personne.tp_type === "HORAIRES" ? "HORAIRES" : "JOURS");

  // JOURS : true = demi-journee NON travaillee
  const [off, setOff] = useState<Record<number, { matin: boolean; aprem: boolean }>>(() => {
    const o: Record<number, { matin: boolean; aprem: boolean }> = {};
    for (const j of JOURS) {
      const list = cfg.off?.[String(j.dow)] ?? [];
      o[j.dow] = { matin: list.includes("matin"), aprem: list.includes("aprem") };
    }
    return o;
  });
  // HORAIRES par jour
  const [hor, setHor] = useState<Record<number, { debut: string; fin: string }>>(() => {
    const h: Record<number, { debut: string; fin: string }> = {};
    for (const j of JOURS) {
      const v = cfg.horaires?.[String(j.dow)];
      h[j.dow] = { debut: v?.debut ?? "", fin: v?.fin ?? "" };
    }
    return h;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(enabled: boolean) {
    setBusy(true);
    setErr("");
    let tp_config: TpConfig | null = null;
    if (enabled) {
      if (type === "JOURS") {
        const o: Record<string, string[]> = {};
        for (const j of JOURS) {
          const list: string[] = [];
          if (off[j.dow].matin) list.push("matin");
          if (off[j.dow].aprem) list.push("aprem");
          if (list.length) o[String(j.dow)] = list;
        }
        tp_config = { off: o };
      } else {
        const h: Record<string, { debut: string; fin: string }> = {};
        for (const j of JOURS) {
          const v = hor[j.dow];
          if (v.debut || v.fin) h[String(j.dow)] = { debut: v.debut, fin: v.fin };
        }
        tp_config = { horaires: h };
      }
    }
    try {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "tp", id: personne.id, temps_partiel: enabled, tp_type: enabled ? type : null, tp_config }),
      });
      if (!res.ok) {
        setErr("Échec de l'enregistrement.");
        return;
      }
      onSaved({ temps_partiel: enabled, tp_type: enabled ? type : null, tp_config });
    } finally {
      setBusy(false);
    }
  }

  const cell: React.CSSProperties = { padding: "4px 8px", textAlign: "center" };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Temps partiel — {personne.label}</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>✕</button>
        </div>

        {/* Choix du type */}
        <div className="segments" style={{ marginBottom: 12 }}>
          <button type="button" className={type === "JOURS" ? "seg active" : "seg"} onClick={() => setType("JOURS")}>
            Jours non travaillés
          </button>
          <button type="button" className={type === "HORAIRES" ? "seg active" : "seg"} onClick={() => setType("HORAIRES")}>
            Horaires spécifiques
          </button>
        </div>

        {type === "JOURS" ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Cochez les demi-journées <strong>non travaillées</strong> (le reste suit les horaires normaux).
              Ces créneaux seront bloqués « TP » dans le planning.
            </p>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Jour</th>
                  <th style={cell}>Matin</th>
                  <th style={cell}>Après-midi</th>
                </tr>
              </thead>
              <tbody>
                {JOURS.map((j) => (
                  <tr key={j.dow}>
                    <td>{j.label}</td>
                    <td style={cell}>
                      <input type="checkbox" checked={off[j.dow].matin} onChange={(e) => setOff((o) => ({ ...o, [j.dow]: { ...o[j.dow], matin: e.target.checked } }))} style={{ width: "auto" }} />
                    </td>
                    <td style={cell}>
                      <input type="checkbox" checked={off[j.dow].aprem} onChange={(e) => setOff((o) => ({ ...o, [j.dow]: { ...o[j.dow], aprem: e.target.checked } }))} style={{ width: "auto" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Horaires par jour de semaine. Ils <strong>remplacent</strong> les horaires standards du poste à
              l&apos;affichage. Laisser vide = horaire standard ce jour-là.
            </p>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Jour</th>
                  <th style={cell}>Début</th>
                  <th style={cell}>Fin</th>
                </tr>
              </thead>
              <tbody>
                {JOURS.map((j) => (
                  <tr key={j.dow}>
                    <td>{j.label}</td>
                    <td style={cell}>
                      <input type="time" value={hor[j.dow].debut} onChange={(e) => setHor((h) => ({ ...h, [j.dow]: { ...h[j.dow], debut: e.target.value } }))} style={{ fontSize: 13, padding: "3px 4px" }} />
                    </td>
                    <td style={cell}>
                      <input type="time" value={hor[j.dow].fin} onChange={(e) => setHor((h) => ({ ...h, [j.dow]: { ...h[j.dow], fin: e.target.value } }))} style={{ fontSize: 13, padding: "3px 4px" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {err && <p style={{ color: "var(--danger)", fontWeight: 600, fontSize: 13 }}>{err}</p>}

        <div className="toolbar" style={{ justifyContent: "space-between", marginTop: 14 }}>
          {personne.temps_partiel ? (
            <button type="button" className="btn-sm btn-ghost" disabled={busy} onClick={() => save(false)} style={{ width: "auto", color: "var(--danger)" }}>
              Désactiver le temps partiel
            </button>
          ) : <span />}
          <button type="button" disabled={busy} onClick={() => save(true)} style={{ width: "auto", padding: "9px 22px" }}>
            {busy ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
