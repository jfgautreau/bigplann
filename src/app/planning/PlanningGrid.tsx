"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Jour = { iso: string; nom: string; num: string; firstOfWeek: boolean };
type WeekBlock = { num: number; span: number; year: number; isCurrent: boolean };
type Poste = { id: string; nom: string; niveauMin: number; effectif: number; categorie?: string };

const CAT_BILANS: { key: string; label: string }[] = [
  { key: "manager", label: "Managers" },
  { key: "conducteur", label: "Conducteurs" },
  { key: "operateur", label: "Opérateurs" },
];
type Group = { ligneNom: string; ligneId: string; postes: Poste[] };
type Motif = { id: string; code: string; couleur: string };
type Personne = { id: string; label: string; equipe_id: string | null; editable: boolean; color?: string };

export default function PlanningGrid({
  days,
  weekBlocks = [],
  todayIso = "",
  personnes = [],
  statIds = [],
  groups = [],
  openByIso = {},
  motifs = [],
  besoin = [],
  initial = {},
  matrice = {},
  quart = "",
  otherByCell = {},
  quartLabel = {},
  posteLabelAll = {},
  exceptions = {},
}: {
  days: Jour[];
  weekBlocks?: WeekBlock[];
  todayIso?: string;
  personnes?: Personne[];
  statIds?: string[];
  groups?: Group[];
  openByIso?: Record<string, string[]>;
  motifs?: Motif[];
  besoin?: number[];
  initial?: Record<string, string>;
  matrice?: Record<string, number>;
  quart?: string;
  otherByCell?: Record<string, string>;
  quartLabel?: Record<string, string>;
  posteLabelAll?: Record<string, string>;
  exceptions?: Record<string, { debut: string; fin: string; motif: string }>;
}) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Surlignage d'un type d'anomalie pour un jour donne (clic sur une puce d'en-tete).
  const [highlight, setHighlight] = useState<{ iso: string; type: "hc" | "over" } | null>(null);
  const toggleHi = (iso: string, type: "hc" | "over") =>
    setHighlight((h) => (h && h.iso === iso && h.type === type ? null : { iso, type }));

  // Horaires specifiques (exceptions) : etat local + popover d'edition par case.
  const [exc, setExc] = useState(exceptions);
  const [excAt, setExcAt] = useState<string | null>(null); // cle "pid:iso"
  const [draft, setDraft] = useState<{ debut: string; fin: string; motif: string }>({ debut: "", fin: "", motif: "" });
  const excKey = (pid: string, iso: string) => `${pid}:${iso}`;
  function openExc(pid: string, iso: string) {
    const e = exc[excKey(pid, iso)] ?? { debut: "", fin: "", motif: "" };
    setDraft({ debut: e.debut, fin: e.fin, motif: e.motif });
    setExcAt(excKey(pid, iso));
  }
  async function saveExc(pid: string, iso: string) {
    const k = excKey(pid, iso);
    const res = await fetch("/api/horaire-exception", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "save", personne_id: pid, jour: iso, ...draft }),
    });
    if (res.ok) {
      setExc((s) => {
        const n = { ...s };
        if (!draft.debut && !draft.fin && !draft.motif) delete n[k];
        else n[k] = { ...draft };
        return n;
      });
      setExcAt(null);
    }
  }
  async function clearExc(pid: string, iso: string) {
    const res = await fetch("/api/horaire-exception", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "delete", personne_id: pid, jour: iso }),
    });
    if (res.ok) {
      setExc((s) => {
        const n = { ...s };
        delete n[excKey(pid, iso)];
        return n;
      });
      setExcAt(null);
    }
  }
  const excLabel = (e: { debut: string; fin: string }) => `${e.debut || "?"}-${e.fin || "?"}`;

  const key = (pid: string, iso: string) => `${pid}:${iso}`;
  const isPoste = (v: string) => v !== "" && v !== "X" && !v.startsWith("m:");
  const motifColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of motifs) m[`m:${x.id}`] = x.couleur;
    return m;
  }, [motifs]);

  // Index de semaine par colonne (pour le remplissage de semaine)
  const weekIdx = useMemo(() => {
    const arr: number[] = [];
    let w = -1;
    days.forEach((d, i) => {
      if (d.firstOfWeek) w++;
      arr[i] = w;
    });
    return arr;
  }, [days]);

  // Indices de colonnes par bloc-semaine
  const blockDayIndices = useMemo(() => {
    const m: number[][] = [];
    days.forEach((_, i) => {
      (m[weekIdx[i]] ??= []).push(i);
    });
    return m;
  }, [days, weekIdx]);

  const { niveauMin, effectif } = useMemo(() => {
    const nm: Record<string, number> = {};
    const ef: Record<string, number> = {};
    for (const g of groups)
      for (const p of g.postes) {
        nm[p.id] = p.niveauMin;
        ef[p.id] = p.effectif;
      }
    return { niveauMin: nm, effectif: ef };
  }, [groups]);

  const { posteLigne, posteLabel, posteCat, allLigneIds } = useMemo(() => {
    const pl: Record<string, string> = {};
    const lab: Record<string, string> = {};
    const cat: Record<string, string> = {};
    const ids: string[] = [];
    for (const g of groups) {
      ids.push(g.ligneId);
      for (const p of g.postes) {
        pl[p.id] = g.ligneId;
        lab[p.id] = p.nom;
        cat[p.id] = p.categorie ?? "operateur";
      }
    }
    return { posteLigne: pl, posteLabel: lab, posteCat: cat, allLigneIds: ids };
  }, [groups]);

  const horsComp = (pid: string, v: string) =>
    isPoste(v) && (matrice[`${pid}:${v}`] ?? 0) < (niveauMin[v] ?? 0);

  // Indicateurs comptes sur TOUTES les personnes du quart (statIds), pas seulement
  // l'equipe affichee : le besoin et le present concernent l'ensemble du quart.
  const indicIds = statIds.length ? statIds : personnes.map((p) => p.id);
  const perDay = days.map((d) => {
    const counts: Record<string, number> = {};
    const catPresent: Record<string, number> = { manager: 0, conducteur: 0, operateur: 0 };
    let present = 0;
    let alerts = 0;
    for (const pid of indicIds) {
      const v = vals[key(pid, d.iso)] ?? "";
      // On ne compte que les placements sur un poste affiche (cadre l'atelier filtre).
      if (isPoste(v) && posteLigne[v] !== undefined) {
        present++;
        counts[v] = (counts[v] ?? 0) + 1;
        const c = posteCat[v];
        if (c && c in catPresent) catPresent[c]++;
        if (horsComp(pid, v)) alerts++;
      }
    }
    let overCount = 0;
    for (const [pid, c] of Object.entries(counts)) if (c > (effectif[pid] ?? 0)) overCount++;
    // Besoin par categorie = effectifs requis des postes sur les lignes ouvertes ce jour.
    const openLines = new Set(openByIso[d.iso] ?? allLigneIds);
    const catRequis: Record<string, number> = { manager: 0, conducteur: 0, operateur: 0 };
    for (const g of groups)
      if (openLines.has(g.ligneId))
        for (const p of g.postes) {
          const c = p.categorie ?? "operateur";
          if (c in catRequis) catRequis[c] += p.effectif ?? 0;
        }
    return { counts, present, alerts, overCount, catPresent, catRequis };
  });

  async function postCell(pid: string, iso: string, equipe_id: string | null, value: string) {
    const res = await fetch("/api/placement/cell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personne_id: pid, jour: iso, equipe_id, value, quart }),
    });
    if (!res.ok) throw new Error();
  }

  async function change(pid: string, iso: string, equipe_id: string | null, value: string) {
    const k = key(pid, iso);
    const prev = vals[k] ?? "";
    setVals((s) => ({ ...s, [k]: value }));
    setSaving("saving");
    try {
      await postCell(pid, iso, equipe_id, value);
      setSaving("saved");
    } catch {
      setVals((s) => ({ ...s, [k]: prev })); // refus serveur : on annule le changement
      setSaving("error");
    }
    setTimeout(() => setSaving("idle"), 1200);
  }

  // Recopie la valeur d'une case sur tous les autres jours de la meme semaine.
  async function fillWeek(pers: Personne, dayIndex: number) {
    const value = vals[key(pers.id, days[dayIndex].iso)] ?? "";
    // On ne touche pas aux jours ou la personne est deja placee sur un autre quart.
    const targets = days
      .filter((_, j) => j !== dayIndex && weekIdx[j] === weekIdx[dayIndex])
      .filter((t) => !otherByCell[key(pers.id, t.iso)]);
    const hasExisting = targets.some((t) => (vals[key(pers.id, t.iso)] ?? "") !== "");
    if (hasExisting && !window.confirm("Des affectations existent déjà cette semaine pour cette personne. Les écraser ?")) {
      return;
    }
    setVals((s) => {
      const next = { ...s };
      for (const t of targets) next[key(pers.id, t.iso)] = value;
      return next;
    });
    setSaving("saving");
    try {
      await Promise.all(targets.map((t) => postCell(pers.id, t.iso, pers.equipe_id, value)));
      setSaving("saved");
    } catch {
      setSaving("error");
    }
    setTimeout(() => setSaving("idle"), 1200);
  }

  // Option B : recopie le bloc-semaine precedent (par jour de la semaine) dans le bloc cible.
  async function copyPrevWeek(targetBlock: number) {
    const src = blockDayIndices[targetBlock - 1] ?? [];
    const tgt = blockDayIndices[targetBlock] ?? [];
    if (!src.length || !tgt.length) return;

    const srcByDow: Record<string, number> = {};
    for (const j of src) srcByDow[days[j].nom] = j;

    const existing = personnes.some(
      (p) => p.editable && tgt.some((j) => (vals[key(p.id, days[j].iso)] ?? "") !== "")
    );
    if (existing && !window.confirm("Des affectations existent déjà sur cette semaine. Les écraser avec la semaine précédente ?")) {
      return;
    }

    const updates: { pid: string; iso: string; eq: string | null; value: string }[] = [];
    const next = { ...vals };
    for (const p of personnes) {
      if (!p.editable) continue;
      for (const j of tgt) {
        if (otherByCell[key(p.id, days[j].iso)]) continue; // place sur un autre quart : on ne touche pas
        const s = srcByDow[days[j].nom];
        if (s === undefined) continue;
        const value = vals[key(p.id, days[s].iso)] ?? "";
        next[key(p.id, days[j].iso)] = value;
        updates.push({ pid: p.id, iso: days[j].iso, eq: p.equipe_id, value });
      }
    }
    setVals(next);
    setSaving("saving");
    try {
      await Promise.all(updates.map((u) => postCell(u.pid, u.iso, u.eq, u.value)));
      setSaving("saved");
    } catch {
      setSaving("error");
    }
    setTimeout(() => setSaving("idle"), 1200);
  }

  // Reinitialise (vide) tous les placements de la semaine pour les personnes editables affichees.
  async function resetWeek(block: number) {
    const isos = (blockDayIndices[block] ?? []).map((idx) => days[idx].iso);
    const pids = personnes.filter((p) => p.editable).map((p) => p.id);
    if (!isos.length || !pids.length) return;
    if (!window.confirm("Réinitialiser (vider) tous les placements de cette semaine pour les personnes affichées ?")) {
      return;
    }
    setVals((s) => {
      const n = { ...s };
      for (const p of pids) for (const iso of isos) delete n[`${p}:${iso}`];
      return n;
    });
    setSaving("saving");
    try {
      const res = await fetch("/api/placement/reset-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personne_ids: pids, jours: isos }),
      });
      setSaving(res.ok ? "saved" : "error");
      if (res.ok) router.refresh();
    } catch {
      setSaving("error");
    }
    setTimeout(() => setSaving("idle"), 1200);
  }

  const deltaColor = (d: number) => (d < 0 ? "var(--danger)" : d > 0 ? "#9a3412" : "var(--ok)");
  const sep = (d: Jour): React.CSSProperties => (d.firstOfWeek ? { borderLeft: "3px solid #94a3b8" } : {});
  const isToday = (d: Jour) => d.iso === todayIso;

  return (
    <div className="card" style={{ overflow: "auto", maxHeight: "calc(100vh - 190px)", position: "relative", padding: "6px 12px" }}>
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 12,
          fontSize: 12,
          fontWeight: 600,
          color: saving === "error" ? "var(--danger)" : saving === "saved" ? "var(--ok)" : "var(--muted)",
        }}
      >
        {saving === "saving" ? "Enregistrement..." : saving === "saved" ? "Enregistré" : saving === "error" ? "Échec" : ""}
      </div>

      <table className="matrix" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ position: "sticky", left: 0, top: 0, zIndex: 25, background: "#fff", textAlign: "left", padding: "2px 8px" }} />
            {weekBlocks.map((w, i) => (
              <th
                key={i}
                colSpan={w.span}
                style={{
                  textAlign: "center",
                  padding: "2px 8px",
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  borderLeft: "3px solid #94a3b8",
                  background: w.isCurrent ? "#dbeafe" : "#f8fafc",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: w.isCurrent ? 700 : undefined }}>
                  {w.year} · Semaine {w.num}
                  {w.isCurrent && <span className="muted" style={{ fontWeight: 400 }}>(en cours)</span>}
                  {i >= 1 && (
                    <button
                      type="button"
                      className="btn-sm btn-ghost"
                      style={{ padding: "2px 6px", fontSize: 11 }}
                      onClick={() => copyPrevWeek(i)}
                      title="Recopier la semaine précédente dans celle-ci"
                    >
                      &larr; S-1
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-sm btn-ghost"
                    style={{ padding: "2px 6px", fontSize: 11 }}
                    onClick={() => resetWeek(i)}
                    title="Réinitialiser (vider) la semaine"
                  >
                    Vider
                  </button>
                </span>
              </th>
            ))}
          </tr>
          <tr>
            {days.map((d) => (
              <th key={d.iso} style={{ textAlign: "center", minWidth: 58, padding: "2px 4px", position: "sticky", top: 26, zIndex: 20, ...sep(d), background: isToday(d) ? "#dbeafe" : "#fff" }}>
                {d.nom.slice(0, 2)}
                <br />
                <span className="muted" style={{ fontWeight: 400 }}>{d.num}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["Besoin", (i: number) => `${besoin[i] ?? 0}`, () => "var(--muted)"],
              ["Présent", (i: number) => `${perDay[i].present}`, () => "var(--text)"],
              [
                "Delta",
                (i: number) => {
                  const d = perDay[i].present - (besoin[i] ?? 0);
                  return d > 0 ? `+${d}` : `${d}`;
                },
                (i: number) => deltaColor(perDay[i].present - (besoin[i] ?? 0)),
              ],
            ] as [string, (i: number) => string, (i: number) => string][]
          ).map(([label, get, color]) => (
            <tr key={label} style={{ background: "#f8fafc" }}>
              <td style={{ position: "sticky", left: 0, background: "#f8fafc", fontWeight: 600, padding: "1px 8px" }}>{label}</td>
              {days.map((d, i) => (
                <td key={d.iso} style={{ textAlign: "center", fontWeight: 700, padding: "1px 4px", color: color(i), ...sep(d), background: isToday(d) ? "#eef2ff" : undefined }}>
                  {get(i)}
                </td>
              ))}
            </tr>
          ))}

          {/* Bilans par categorie : presents / requis par jour (quart affiche) */}
          {CAT_BILANS.map((cat) => (
            <tr key={cat.key} style={{ background: "#f8fafc" }}>
              <td style={{ position: "sticky", left: 0, background: "#f8fafc", fontWeight: 600, padding: "1px 8px", whiteSpace: "nowrap" }}>
                {cat.label}
              </td>
              {days.map((d, i) => {
                const pres = perDay[i].catPresent[cat.key] ?? 0;
                const req = perDay[i].catRequis[cat.key] ?? 0;
                const manque = req > 0 && pres < req;
                return (
                  <td
                    key={d.iso}
                    style={{
                      textAlign: "center",
                      fontWeight: 700,
                      padding: "1px 4px",
                      color: manque ? "#7f1d1d" : "var(--text)",
                      background: manque ? "#fee2e2" : isToday(d) ? "#eef2ff" : undefined,
                      ...sep(d),
                    }}
                    title={`${cat.label} : ${pres} présents / ${req} requis`}
                  >
                    {pres}
                    <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.7 }}>/{req}</span>
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Ligne d'alertes : puces cliquables (hors-competence / sur-effectif) */}
          <tr style={{ background: "#f8fafc" }}>
            <td style={{ position: "sticky", left: 0, background: "#f8fafc", fontWeight: 600, padding: "1px 8px" }}>Alertes</td>
            {days.map((d, i) => {
              const hc = perDay[i].alerts;
              const ov = perDay[i].overCount;
              const hcOn = highlight?.iso === d.iso && highlight.type === "hc";
              const ovOn = highlight?.iso === d.iso && highlight.type === "over";
              return (
                <td key={d.iso} style={{ textAlign: "center", padding: "2px 2px", ...sep(d), background: isToday(d) ? "#eef2ff" : undefined }}>
                  {hc > 0 && (
                    <button
                      type="button"
                      className={`alert-pill hc${hcOn ? " active" : ""}`}
                      onClick={() => toggleHi(d.iso, "hc")}
                      title="Hors compétence — cliquer pour surligner"
                    >
                      {hc}
                    </button>
                  )}
                  {ov > 0 && (
                    <button
                      type="button"
                      className={`alert-pill over${ovOn ? " active" : ""}`}
                      onClick={() => toggleHi(d.iso, "over")}
                      title="Postes en sur-effectif — cliquer pour surligner"
                    >
                      {ov}
                    </button>
                  )}
                  {hc === 0 && ov === 0 && <span className="muted">·</span>}
                </td>
              );
            })}
          </tr>

          {personnes.map((pers) => (
            <tr key={pers.id}>
              <td style={{ position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 4,
                    height: 14,
                    borderRadius: 2,
                    background: pers.color ?? "transparent",
                    marginRight: 6,
                    verticalAlign: "middle",
                  }}
                />
                {pers.label}
                {!pers.editable && <span className="muted"> (lecture)</span>}
              </td>
              {days.map((d, i) => {
                const v = vals[key(pers.id, d.iso)] ?? "";
                const alert = horsComp(pers.id, v);
                const over = isPoste(v) && (perDay[i].counts[v] ?? 0) > (effectif[v] ?? 0);
                const openSet = new Set(openByIso[d.iso] ?? allLigneIds);
                const closedCurrent = isPoste(v) && !openSet.has(posteLigne[v] ?? "");
                // Bouton de recopie aussi sur une case vide : permet de propager le
                // « non-affecte » sur la semaine. Masque seulement si placee sur un autre quart.
                const showFill = pers.editable && !otherByCell[key(pers.id, d.iso)];
                const other = v === "" ? otherByCell[key(pers.id, d.iso)] : undefined;
                // Surlignage : cette case correspond-elle au type d'anomalie selectionne ce jour-la ?
                const hiActive = highlight?.iso === d.iso;
                const matchHi = !!hiActive && ((highlight!.type === "hc" && alert) || (highlight!.type === "over" && over));
                const dimHi = !!hiActive && !matchHi;
                return (
                  <td
                    key={d.iso}
                    className={`pcell${alert ? " hc" : ""}${over ? " over" : ""}${matchHi ? " hi" : ""}${dimHi ? " dim" : ""}`}
                    style={{
                      textAlign: "center",
                      background: alert ? "#fff1f2" : motifColor[v] ? motifColor[v] : over ? "#fffbeb" : isToday(d) ? "#eff6ff" : undefined,
                      padding: 2,
                      position: "relative",
                      ...sep(d),
                    }}
                    title={[alert ? "Hors compétence" : "", over ? `Sur-effectif (${perDay[i].counts[v]}/${effectif[v] ?? 0})` : ""].filter(Boolean).join(" · ") || undefined}
                  >
                    {alert && <span className="cell-badge" aria-hidden />}
                    <select
                      className="flat"
                      value={v}
                      disabled={!pers.editable || !!other}
                      title={other ? "Déjà placé sur un autre quart ce jour-là" : undefined}
                      onChange={(e) => change(pers.id, d.iso, pers.equipe_id, e.target.value)}
                      style={{ width: "100%", fontSize: 12, padding: "3px 1px", opacity: other ? 0.6 : 1 }}
                    >
                      <option value="">—</option>
                      <option value="X">NT</option>
                      {closedCurrent && (
                        <option value={v}>
                          {posteLabel[v] ?? posteLabelAll[v] ?? "?"}
                          {posteLigne[v] !== undefined ? " (ligne fermée)" : " (autre atelier)"}
                        </option>
                      )}
                      {groups
                        .filter((g) => openSet.has(g.ligneId))
                        .map((g) => (
                          <optgroup key={g.ligneNom} label={g.ligneNom}>
                            {g.postes.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nom}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      {motifs.length > 0 && (
                        <optgroup label="Absences">
                          {motifs.map((mo) => (
                            <option key={mo.id} value={`m:${mo.id}`}>
                              {mo.code}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {over && (
                      <div className="cell-over" aria-hidden>
                        {perDay[i].counts[v]}/{effectif[v] ?? 0}
                      </div>
                    )}
                    {showFill && (
                      <button
                        type="button"
                        className="fillw"
                        title="Remplir toute la semaine avec cette valeur"
                        onClick={() => fillWeek(pers, i)}
                      >
                        &raquo;
                      </button>
                    )}
                    {(() => {
                      const ek = excKey(pers.id, d.iso);
                      const e = exc[ek];
                      const canEditExc = pers.editable && isPoste(v);
                      if (!e && !canEditExc) return null;
                      return (
                        <>
                          {canEditExc ? (
                            <button
                              type="button"
                              className={`horx${e ? " has" : ""}`}
                              title={e ? `Horaire spécifique : ${excLabel(e)}${e.motif ? " · " + e.motif : ""}` : "Définir un horaire spécifique"}
                              onClick={() => openExc(pers.id, d.iso)}
                            >
                              🕐
                            </button>
                          ) : (
                            e && <span className="horx has" title={`Horaire spécifique : ${excLabel(e)}`}>🕐</span>
                          )}
                          {excAt === ek && (
                            <div className="exc-pop" onClick={(ev) => ev.stopPropagation()}>
                              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Horaire spécifique</div>
                              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                                <input type="time" value={draft.debut} onChange={(ev) => setDraft((s) => ({ ...s, debut: ev.target.value }))} style={{ fontSize: 12, padding: "2px 3px" }} />
                                <input type="time" value={draft.fin} onChange={(ev) => setDraft((s) => ({ ...s, fin: ev.target.value }))} style={{ fontSize: 12, padding: "2px 3px" }} />
                              </div>
                              <input
                                placeholder="motif (optionnel)"
                                value={draft.motif}
                                onChange={(ev) => setDraft((s) => ({ ...s, motif: ev.target.value }))}
                                style={{ width: "100%", fontSize: 12, padding: "2px 3px", marginBottom: 6 }}
                              />
                              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                <button type="button" className="btn-sm" style={{ padding: "2px 8px" }} onClick={() => saveExc(pers.id, d.iso)}>OK</button>
                                {e && (
                                  <button type="button" className="btn-sm btn-ghost" style={{ padding: "2px 8px" }} onClick={() => clearExc(pers.id, d.iso)}>Effacer</button>
                                )}
                                <button type="button" className="btn-sm btn-ghost" style={{ padding: "2px 8px" }} onClick={() => setExcAt(null)}>×</button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {other && (
                      <div
                        style={{ fontSize: 9, color: "#9a3412", marginTop: -1 }}
                        title={`Placé sur un autre quart : ${quartLabel[other] ?? other}`}
                      >
                        &rarr; {quartLabel[other] ?? other}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {personnes.length === 0 && (
            <tr>
              <td colSpan={days.length + 1} className="muted">Aucune personne (choisissez une équipe).</td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="muted" style={{ marginTop: 10 }}>
        Survolez une case et cliquez sur &raquo; pour recopier sa valeur sur toute la
        semaine (y compris « non-affecté » pour vider la semaine).{" "}
        <span className="legend-swatch hc" /> hors compétence ·{" "}
        <span className="legend-swatch over" /> sur-effectif (badge présents/requis) ·
        cliquez une pastille colorée de la ligne « Alertes » pour surligner les cases
        concernées · <span style={{ background: "#1d4ed8", color: "#fff", borderRadius: 3, padding: "0 3px", fontSize: 10 }}>🕐</span> horaire
        spécifique (survolez une case placée) · jours sans ligne ouverte masqués.
      </p>
    </div>
  );
}
