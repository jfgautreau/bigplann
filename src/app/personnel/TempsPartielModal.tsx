"use client";

import { useState } from "react";
import { rotationForWeek, type RotationRef } from "@/lib/rotation";
import { mondayOf, isoDate, addDays } from "@/lib/week";

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

// --- Cas types ---------------------------------------------------------
// On saisit un PROFIL, pas des primitives : la modale traduit ensuite en
// `off` / `demi`. Les cinq cas couvrent l'ecrasante majorite des contrats ;
// « Sur mesure » laisse la main sur la grille, inchangee.
//
// ⚠️ « Mi-temps apres-midi » ne veut PAS dire « une semaine sur deux ». Sur une
// equipe tournante, l'alternance vient de la ROTATION : la personne ne peut
// travailler que les semaines ou son equipe est sur son creneau. C'est ce que
// l'apercu de quinzaine donne a voir.
type Preset = {
  cle: string;
  titre: string;
  detail: string;
  applique: () => { off: Record<number, { matin: boolean; aprem: boolean }>; demiMode?: "matin" | "aprem" | "tournant" };
};

const offVide = () => {
  const o: Record<number, { matin: boolean; aprem: boolean }> = {};
  for (const j of JOURS) o[j.dow] = { matin: false, aprem: false };
  return o;
};
const offSemaine = (creneau: "matin" | "aprem") => {
  const o = offVide();
  for (const j of JOURS) if (j.dow <= 5) o[j.dow][creneau] = true;
  return o;
};

export default function TempsPartielModal({
  personne,
  equipe = null,
  quarts = [],
  rotationRefs = [],
  onClose,
  onSaved,
}: {
  personne: Pers;
  equipe?: { id: string; nom: string; quart_fixe?: string | null } | null;
  quarts?: { code: string; libelle: string }[];
  rotationRefs?: RotationRef[];
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
  // Reglages detailles : replies par defaut si un cas type suffit, deplies
  // d'emblee quand la configuration existante ne colle a aucun d'eux.
  const [avance, setAvance] = useState(!!personne.tp_config);

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

  // --- Cas types -------------------------------------------------------
  const PRESETS: Preset[] = [
    {
      cle: "mt-matin",
      titre: "Mi-temps matin",
      detail: "Travaille les matins, du lundi au vendredi.",
      applique: () => ({ off: offSemaine("aprem"), demiMode: "tournant" }),
    },
    {
      cle: "mt-aprem",
      titre: "Mi-temps après-midi",
      detail: "Travaille les après-midi, du lundi au vendredi.",
      applique: () => ({ off: offSemaine("matin"), demiMode: "tournant" }),
    },
    {
      cle: "jours",
      titre: "Jour(s) non travaillé(s)",
      detail: "Journées entières en moins (ex. le mercredi).",
      applique: () => ({ off: offVide() }),
    },
    {
      cle: "horaires",
      titre: "Horaires réduits",
      detail: "Présente tous les jours, mais sur des horaires propres.",
      applique: () => ({ off: offVide() }),
    },
  ];

  function appliquerPreset(p: Preset) {
    const r = p.applique();
    setOff(r.off);
    const aDesOff = JOURS.some((j) => r.off[j.dow].matin || r.off[j.dow].aprem);
    setOffOn(aDesOff);
    if (r.demiMode) {
      setDemiOn(true);
      setDemiMode(r.demiMode);
      setDemiSource("quart");
    } else {
      setDemiOn(false);
    }
    setHorOn(p.cle === "horaires");
    setAvance(p.cle === "jours" || p.cle === "horaires");
  }

  // --- Synthese --------------------------------------------------------
  // ⚠️ « matin » et « apres_midi » sont des QUARTS (postes entiers), pas des
  // demi-journees : quelqu'un sur le quart d'apres-midi fait une journee pleine.
  // `off[jour]` liste donc les quarts que la personne n'assure PAS ce jour-la.
  // Le taux se compte en POSTES travailles, pas en demi-journees — sans quoi un
  // mi-temps « apres-midi une semaine sur deux » sortirait a 25 % au lieu de 50 %.
  const ouvres = JOURS.filter((j) => j.dow <= 5);
  const postesSemaine = (quartEquipe: string | null) => {
    if (!offOn) return ouvres.length;
    const cle = quartEquipe === "matin" ? "matin" : quartEquipe === "apres_midi" ? "aprem" : null;
    // Quart « journee » ou « nuit » : la personne est ecartee seulement si la
    // journee entiere est exclue (meme regle que le planning).
    if (!cle) return ouvres.filter((j) => !(off[j.dow].matin && off[j.dow].aprem)).length;
    return ouvres.filter((j) => !off[j.dow][cle as "matin" | "aprem"]).length;
  };

  // Creneau impose : TOUS les postes d'un quart sont exclus sur les jours ouvres.
  const tousMatinsOff = offOn && ouvres.every((j) => off[j.dow].matin);
  const tousApremOff = offOn && ouvres.every((j) => off[j.dow].aprem);
  const creneau: "matin" | "apres_midi" | null =
    tousApremOff && !tousMatinsOff ? "matin" : tousMatinsOff && !tousApremOff ? "apres_midi" : null;

  // Rotation de l'equipe sur la quinzaine a venir : c'est elle, et non le temps
  // partiel, qui produit les « une semaine sur deux ».
  const lundi0 = isoDate(mondayOf());
  const semaines = [0, 1].map((k) => {
    const iso = isoDate(addDays(mondayOf(), k * 7));
    const quartEquipe = equipe ? equipe.quart_fixe ?? rotationForWeek(rotationRefs, iso)[equipe.id] ?? null : null;
    const postes = postesSemaine(quartEquipe);
    return { iso, quartEquipe, postes, travaille: postes > 0 };
  });
  const quartLib = (c: string | null) => (c ? quarts.find((q) => q.code === c)?.libelle ?? c : "—");
  const fmtLundi = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

  const alterne = !!equipe && !equipe.quart_fixe && semaines[0].postes !== semaines[1].postes;
  // Taux sur la quinzaine (10 postes = temps plein). Sur une equipe a quart fixe,
  // la quinzaine est identique : on retombe naturellement sur la semaine.
  const postesQuinzaine = semaines[0].postes + semaines[1].postes;
  const taux = Math.round((postesQuinzaine / 10) * 100);

  const resume = (() => {
    if (!demiOn && !offOn && !horOn) return "Aucune option cochée — le temps partiel ne s'appliquera pas.";
    const bouts: string[] = [];
    if (creneau === "matin") bouts.push("quart du matin uniquement");
    else if (creneau === "apres_midi") bouts.push("quart d'après-midi uniquement");
    else if (offOn && semaines[0].postes < ouvres.length) bouts.push(`${ouvres.length - semaines[0].postes} jour(s) en moins par semaine`);
    if (alterne) bouts.push("une semaine sur deux (rotation de l'équipe)");
    // Une demi-journee avec horaires saisis raccourcit le poste : le taux ci-dessus
    // compte des postes, il devient un majorant. On le dit plutot que de bricoler.
    if (demiOn && demiSource === "horaires") bouts.push("demi-journées (taux réel inférieur)");
    if (horOn) bouts.push("horaires spécifiques");
    return bouts.length ? bouts.join(" · ") : "Temps plein sur les jours ouvrés.";
  })();

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: "100%", maxHeight: "92vh", overflow: "auto" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Temps partiel — {personne.label}</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>✕</button>
        </div>
        {/* --- Cas types : on part du profil, pas des primitives --- */}
        <p className="muted" style={{ marginTop: 0, marginBottom: 8 }}>
          Choisissez un cas type, puis ajustez si besoin.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {PRESETS.map((p) => (
            <button
              key={p.cle}
              type="button"
              onClick={() => appliquerPreset(p)}
              title={p.detail}
              className="btn-sm"
              style={{ background: "#fff", color: "var(--text)", border: "1px solid var(--border)", textAlign: "left" }}
            >
              {p.titre}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAvance((v) => !v)}
            className="btn-sm btn-ghost"
            style={{ marginLeft: "auto" }}
          >
            {avance ? "▴ Masquer le détail" : "▾ Sur mesure"}
          </button>
        </div>

        {/* --- Synthese + apercu de la quinzaine ---
            Le point aveugle de l'ancienne modale : on saisissait sans voir le
            resultat. L'alternance « une semaine sur deux » ne vient pas du temps
            partiel mais de la rotation de l'equipe — il faut donc la MONTRER. */}
        <div className="card section" style={{ background: "#f8fafc", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15 }}>≈ {taux} %</strong>
            <span className="muted" style={{ fontSize: 12 }}>({postesQuinzaine} postes sur 10 par quinzaine)</span>
            <span style={{ fontSize: 13 }}>{resume}</span>
          </div>

          {equipe ? (
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Deux prochaines semaines — équipe {equipe.nom}
                {equipe.quart_fixe ? ` (quart fixe : ${quartLib(equipe.quart_fixe)})` : " (tournante)"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {semaines.map((sm) => (
                  <div
                    key={sm.iso}
                    style={{
                      flex: "1 1 180px",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: sm.travaille ? "#16a34a" : "#cbd5e1",
                      background: sm.travaille ? "#f0fdf4" : "#f1f5f9",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      Semaine du {fmtLundi(sm.iso)}
                      {sm.iso === lundi0 && <span className="muted" style={{ fontWeight: 400 }}> (en cours)</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>Équipe en {quartLib(sm.quartEquipe)}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: sm.travaille ? "#166534" : "#64748b" }}>
                      {sm.travaille ? `Travaille — ${sm.postes} poste${sm.postes > 1 ? "s" : ""}` : "Ne travaille pas"}
                    </div>
                  </div>
                ))}
              </div>
              {alterne && (
                <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
                  L&apos;alternance vient de la <strong>rotation de l&apos;équipe</strong>, pas du temps partiel :
                  la personne ne travaille que les semaines où son équipe est sur son créneau.
                </p>
              )}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
              Aucune équipe affectée : l&apos;aperçu de la rotation n&apos;est pas calculable.
            </p>
          )}
        </div>

        {avance && (
        <>
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
                  <button
                    type="button"
                    className={demiMode === "tournant" ? "seg active" : "seg"}
                    onClick={() => setDemiMode("tournant")}
                    title="La personne suit le quart de son équipe ; aucune demi-journée n'est imposée par le temps partiel."
                  >
                    Suit le quart de l&apos;équipe
                  </button>
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
