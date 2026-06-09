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
type HMap = Record<string, { debut: string; fin: string }>;
type DemiCfg = { mode: string; source: string; matin?: HMap; aprem?: HMap };
type TpConfig = { demi?: DemiCfg; off?: Record<string, string[]>; horaires?: HMap };
type Pers = { id: string; label: string; temps_partiel: boolean; tp_type: string | null; tp_config: TpConfig | null };

const emptyH = (): Record<number, { debut: string; fin: string }> => {
  const o: Record<number, { debut: string; fin: string }> = {};
  for (const j of JOURS) o[j.dow] = { debut: "", fin: "" };
  return o;
};
const fromHMap = (m?: HMap) => {
  const o = emptyH();
  if (m) for (const j of JOURS) if (m[String(j.dow)]) o[j.dow] = { ...m[String(j.dow)] };
  return o;
};
const toHMap = (o: Record<number, { debut: string; fin: string }>): HMap => {
  const m: HMap = {};
  for (const j of JOURS) if (o[j.dow].debut || o[j.dow].fin) m[String(j.dow)] = o[j.dow];
  return m;
};

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

  // Section 1 : demi-journee
  const [demiOn, setDemiOn] = useState(!!cfg.demi);
  const [demiMode, setDemiMode] = useState<"matin" | "aprem" | "tournant">((cfg.demi?.mode as "matin" | "aprem" | "tournant") ?? "matin");
  const [demiSource, setDemiSource] = useState<"quart" | "horaires">((cfg.demi?.source as "quart" | "horaires") ?? "quart");
  const [demiMatin, setDemiMatin] = useState(fromHMap(cfg.demi?.matin));
  const [demiAprem, setDemiAprem] = useState(fromHMap(cfg.demi?.aprem));

  // Section 2 : jours non travailles
  const [offOn, setOffOn] = useState(!!cfg.off && Object.keys(cfg.off).length > 0);
  const [off, setOff] = useState<Record<number, { matin: boolean; aprem: boolean }>>(() => {
    const o: Record<number, { matin: boolean; aprem: boolean }> = {};
    for (const j of JOURS) {
      const list = cfg.off?.[String(j.dow)] ?? [];
      o[j.dow] = { matin: list.includes("matin"), aprem: list.includes("aprem") };
    }
    return o;
  });

  // Section 3 : horaires journee entiere
  const [horOn, setHorOn] = useState(!!cfg.horaires && Object.keys(cfg.horaires).length > 0);
  const [hor, setHor] = useState(fromHMap(cfg.horaires));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(enable: boolean) {
    setBusy(true);
    setErr("");
    const enabled = enable && (demiOn || offOn || horOn);
    let tp_config: TpConfig | null = null;
    if (enabled) {
      tp_config = {};
      if (demiOn) {
        const d: DemiCfg = { mode: demiMode, source: demiSource };
        if (demiSource === "horaires") {
          if (demiMode !== "aprem") d.matin = toHMap(demiMatin);
          if (demiMode !== "matin") d.aprem = toHMap(demiAprem);
        }
        tp_config.demi = d;
      }
      if (offOn) {
        const o: Record<string, string[]> = {};
        for (const j of JOURS) {
          const list: string[] = [];
          if (off[j.dow].matin) list.push("matin");
          if (off[j.dow].aprem) list.push("aprem");
          if (list.length) o[String(j.dow)] = list;
        }
        tp_config.off = o;
      }
      if (horOn) tp_config.horaires = toHMap(hor);
    }
    try {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "tp", id: personne.id, temps_partiel: enabled, tp_type: null, tp_config }),
      });
      if (!res.ok) {
        setErr("Échec de l'enregistrement.");
        return;
      }
      onSaved({ temps_partiel: enabled, tp_type: null, tp_config });
    } finally {
      setBusy(false);
    }
  }

  const cell: React.CSSProperties = { padding: "3px 8px", textAlign: "center" };
  const timeInp: React.CSSProperties = { fontSize: 13, padding: "3px 4px", width: 96 };
  const showMatin = demiMode !== "aprem";
  const showAprem = demiMode !== "matin";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: "100%", maxHeight: "92vh", overflow: "auto" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Temps partiel — {personne.label}</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>✕</button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>Options cumulables. Cochez celles qui s&apos;appliquent.</p>

        {/* Section 1 : demi-journee */}
        <div className="card section" style={{ background: demiOn ? "#f0f9ff" : undefined }}>
          <label style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={demiOn} onChange={(e) => setDemiOn(e.target.checked)} style={{ width: "auto" }} />
            Demi-journée (ne travaille qu&apos;une demi-journée)
          </label>
          {demiOn && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <span className="muted">Créneau :</span>
                <div className="segments">
                  <button type="button" className={demiMode === "matin" ? "seg active" : "seg"} onClick={() => setDemiMode("matin")}>Matin (fixe)</button>
                  <button type="button" className={demiMode === "aprem" ? "seg active" : "seg"} onClick={() => setDemiMode("aprem")}>Après-midi (fixe)</button>
                  <button type="button" className={demiMode === "tournant" ? "seg active" : "seg"} onClick={() => setDemiMode("tournant")}>Tournant (suit l&apos;équipe)</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <span className="muted">Horaire :</span>
                <div className="segments">
                  <button type="button" className={demiSource === "quart" ? "seg active" : "seg"} onClick={() => setDemiSource("quart")}>Quart système</button>
                  <button type="button" className={demiSource === "horaires" ? "seg active" : "seg"} onClick={() => setDemiSource("horaires")}>Horaires saisis</button>
                </div>
              </div>
              {demiSource === "horaires" && (
                <table style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Jour</th>
                      {showMatin && <th style={cell} colSpan={2}>Matin</th>}
                      {showAprem && <th style={cell} colSpan={2}>Après-midi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {JOURS.map((j) => (
                      <tr key={j.dow}>
                        <td>{j.label}</td>
                        {showMatin && (
                          <>
                            <td style={cell}><input type="time" value={demiMatin[j.dow].debut} onChange={(e) => setDemiMatin((h) => ({ ...h, [j.dow]: { ...h[j.dow], debut: e.target.value } }))} style={timeInp} /></td>
                            <td style={cell}><input type="time" value={demiMatin[j.dow].fin} onChange={(e) => setDemiMatin((h) => ({ ...h, [j.dow]: { ...h[j.dow], fin: e.target.value } }))} style={timeInp} /></td>
                          </>
                        )}
                        {showAprem && (
                          <>
                            <td style={cell}><input type="time" value={demiAprem[j.dow].debut} onChange={(e) => setDemiAprem((h) => ({ ...h, [j.dow]: { ...h[j.dow], debut: e.target.value } }))} style={timeInp} /></td>
                            <td style={cell}><input type="time" value={demiAprem[j.dow].fin} onChange={(e) => setDemiAprem((h) => ({ ...h, [j.dow]: { ...h[j.dow], fin: e.target.value } }))} style={timeInp} /></td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                Fixe : bloqué « → Mat / → Apr » sur l&apos;autre demi-journée dans le planning. Tournant : suit le quart où elle est placée.
              </p>
            </div>
          )}
        </div>

        {/* Section 2 : jours non travailles */}
        <div className="card section" style={{ background: offOn ? "#f0f9ff" : undefined }}>
          <label style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={offOn} onChange={(e) => setOffOn(e.target.checked)} style={{ width: "auto" }} />
            Jours / demi-journées non travaillés
          </label>
          {offOn && (
            <table style={{ width: "100%", marginTop: 8 }}>
              <thead><tr><th style={{ textAlign: "left" }}>Jour</th><th style={cell}>Matin</th><th style={cell}>Après-midi</th></tr></thead>
              <tbody>
                {JOURS.map((j) => (
                  <tr key={j.dow}>
                    <td>{j.label}</td>
                    <td style={cell}><input type="checkbox" checked={off[j.dow].matin} onChange={(e) => setOff((o) => ({ ...o, [j.dow]: { ...o[j.dow], matin: e.target.checked } }))} style={{ width: "auto" }} /></td>
                    <td style={cell}><input type="checkbox" checked={off[j.dow].aprem} onChange={(e) => setOff((o) => ({ ...o, [j.dow]: { ...o[j.dow], aprem: e.target.checked } }))} style={{ width: "auto" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 3 : horaires journee entiere */}
        <div className="card section" style={{ background: horOn ? "#f0f9ff" : undefined }}>
          <label style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={horOn} onChange={(e) => setHorOn(e.target.checked)} style={{ width: "auto" }} />
            Horaires spécifiques (journée entière)
          </label>
          {horOn && (
            <table style={{ width: "100%", marginTop: 8 }}>
              <thead><tr><th style={{ textAlign: "left" }}>Jour</th><th style={cell}>Début</th><th style={cell}>Fin</th></tr></thead>
              <tbody>
                {JOURS.map((j) => (
                  <tr key={j.dow}>
                    <td>{j.label}</td>
                    <td style={cell}><input type="time" value={hor[j.dow].debut} onChange={(e) => setHor((h) => ({ ...h, [j.dow]: { ...h[j.dow], debut: e.target.value } }))} style={timeInp} /></td>
                    <td style={cell}><input type="time" value={hor[j.dow].fin} onChange={(e) => setHor((h) => ({ ...h, [j.dow]: { ...h[j.dow], fin: e.target.value } }))} style={timeInp} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
