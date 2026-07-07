"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Jour = { iso: string; nom: string; num: string; firstOfWeek: boolean };
type WeekBlock = { num: number; span: number; year: number; isCurrent: boolean };
type Poste = { id: string; nom: string; niveauMin: number; effectif: number; categorie?: string };

const CAT_BILANS: { key: string; label: string }[] = [
  { key: "manager", label: "Managers" },
  { key: "conducteur", label: "Conducteurs" },
  { key: "operateur", label: "Opérateurs" },
];
type Group = { ligneNom: string; ligneId: string; atelierNom?: string; postes: Poste[] };
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
  tpBlocked = {},
  tpRedirect = {},
  quartLabel = {},
  posteLabelAll = {},
  exceptions = {},
  weekNav = null,
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
  tpBlocked?: Record<string, boolean>;
  tpRedirect?: Record<string, string>;
  quartLabel?: Record<string, string>;
  posteLabelAll?: Record<string, string>;
  exceptions?: Record<string, { debut: string; fin: string; motif: string }>;
  weekNav?: React.ReactNode;
}) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Surlignage d'un type d'anomalie pour un jour donne (clic sur une puce d'en-tete).
  const [highlight, setHighlight] = useState<{ iso: string; type: "hc" | "over" } | null>(null);
  const toggleHi = (iso: string, type: "hc" | "over") =>
    setHighlight((h) => (h && h.iso === iso && h.type === type ? null : { iso, type }));

  // Horaires specifiques (exceptions) : etat local + popover d'edition par case.
  // Affichage du bilan : persiste dans localStorage car la grille est remontee
  // (prop `key`) a chaque changement de filtre -> sinon l'etat serait reinitialise.
  const [showInd, setShowInd] = useState(true); // afficher la zone Bilan & alertes
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("planning.showBilan") === "0") setShowInd(false);
  }, []);
  const toggleInd = () =>
    setShowInd((s) => {
      const next = !s;
      if (typeof window !== "undefined") window.localStorage.setItem("planning.showBilan", next ? "1" : "0");
      return next;
    });
  // Selection d'une case (contour) pour la touche Suppr, et panneau d'affectation.
  const [selected, setSelected] = useState<string | null>(null);
  const [pick, setPick] = useState<{ pid: string; iso: string; eq: string | null; left: number; top: number; bottom: number } | null>(null);
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

  // Libelle compact de la valeur d'une case (poste / motif / NT / vide).
  const persById = useMemo(() => new Map(personnes.map((p) => [p.id, p])), [personnes]);
  const valueLabel = (v: string) =>
    v === "" ? "—"
    : v === "X" ? "NT"
    : v.startsWith("m:") ? (motifs.find((mo) => `m:${mo.id}` === v)?.code ?? "?")
    : (posteLabel[v] ?? posteLabelAll[v] ?? "?");

  // Clavier : Suppr/Retour efface la case selectionnee ; Echap ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") { setPick(null); setSelected(null); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        const [pid, iso] = selected.split(":");
        const p = persById.get(pid);
        if (p && p.editable) {
          e.preventDefault();
          change(pid, iso, p.equipe_id, "");
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, persById]);

  // Fermer le panneau au clic en dehors.
  useEffect(() => {
    if (!pick) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".cellpick") || t.closest(".cellbtn")) return;
      setPick(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pick]);

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

  // Recopie la valeur d'une case sur les jours SUIVANTS de la meme semaine (futur
  // uniquement) : lundi -> toute la semaine, jeudi -> vendredi/samedi, etc.
  async function fillWeek(pers: Personne, dayIndex: number) {
    const value = vals[key(pers.id, days[dayIndex].iso)] ?? "";
    // On ne touche pas aux jours ou la personne est deja placee sur un autre quart.
    const targets = days
      .filter((_, j) => j > dayIndex && weekIdx[j] === weekIdx[dayIndex])
      .filter((t) => !otherByCell[key(pers.id, t.iso)]);
    if (targets.length === 0) return; // dernier jour de la semaine : rien a recopier
    const hasExisting = targets.some((t) => (vals[key(pers.id, t.iso)] ?? "") !== "");
    if (hasExisting && !window.confirm("Des affectations existent déjà sur les jours suivants pour cette personne. Les écraser ?")) {
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
    if (!window.confirm("Vider les affectations sur lignes de cette semaine pour les personnes affichées ?\nLes absences et le temps partiel sont conservés.")) {
      return;
    }
    setVals((s) => {
      const n = { ...s };
      // On ne retire localement que les affectations sur poste (les absences/NT restent).
      for (const p of pids) for (const iso of isos) { const k = `${p}:${iso}`; if (isPoste(n[k] ?? "")) delete n[k]; }
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
  // En-tetes figes : les lignes d'indicateurs (Besoin..Alertes) restent collees sous
  // les en-tetes de jours quand on descend. Offsets cumulables (a recalibrer si besoin).
  const HEAD_H = 60; // hauteur des 2 lignes d'en-tete (semaine + jours)
  const IND_H = 21; // hauteur d'une ligne d'indicateur
  const STICK_TOP = (rowIdx: number) => HEAD_H + rowIdx * IND_H;
  const indCellStyle = (rowIdx: number, bg: string): React.CSSProperties => ({
    position: "sticky",
    top: STICK_TOP(rowIdx),
    zIndex: 14,
    background: bg,
  });
  const indLeftStyle = (rowIdx: number, bg: string): React.CSSProperties => ({
    position: "sticky",
    left: 0,
    top: STICK_TOP(rowIdx),
    zIndex: 16,
    background: bg,
    fontWeight: 600,
    padding: "1px 8px",
  });

  // Colonne noms adaptative (px), partagee par les 2 tables -> colonnes alignees.
  const nameW = Math.min(300, Math.max(140, personnes.reduce((m, p) => Math.max(m, p.label.length), 0) * 7.2 + 30));
  const Cols = () => (
    <colgroup>
      <col style={{ width: nameW }} />
      {days.map((d) => <col key={d.iso} />)}
    </colgroup>
  );
  const tStyle: React.CSSProperties = { borderCollapse: "collapse", width: "100%", tableLayout: "fixed" };

  return (
    <>
      {/* Tableau 1 : en-tetes (dates) + bilan/alertes retractable (fixe) */}
      <div className="card" style={{ overflowX: "hidden", overflowY: "auto", scrollbarGutter: "stable", position: "relative", padding: "6px 12px" }}>
        <div style={{ position: "absolute", top: 8, right: 12, fontSize: 12, fontWeight: 600, color: saving === "error" ? "var(--danger)" : saving === "saved" ? "var(--ok)" : "var(--muted)" }}>
          {saving === "saving" ? "Enregistrement..." : saving === "saved" ? "Enregistré" : saving === "error" ? "Échec" : ""}
        </div>

      <table className="matrix" style={tStyle}>
        <Cols />
        <thead>
          <tr>
            <th rowSpan={2} style={{ position: "sticky", left: 0, top: 0, zIndex: 25, background: "#fff", textAlign: "center", padding: "2px 6px" }}>
              {weekNav}
              <button
                type="button"
                onClick={toggleInd}
                title={showInd ? "Masquer le bilan & alertes" : "Afficher le bilan & alertes"}
                style={{ width: "auto", margin: 0, padding: "1px 7px", fontSize: 12, fontWeight: 700, lineHeight: 1.4, border: "1px solid var(--border)", borderRadius: 6, background: "#fff", color: "var(--primary)", cursor: "pointer" }}
              >
                {showInd ? "− Bilan" : "+ Bilan"}
              </button>
            </th>
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
                    title="Vider les affectations sur lignes (absences et TP conservés)"
                  >
                    Vider
                  </button>
                </span>
              </th>
            ))}
          </tr>
          <tr>
            {days.map((d) => (
              <th key={d.iso} style={{ textAlign: "center", padding: "2px 2px", position: "sticky", top: 26, zIndex: 20, ...sep(d), borderBottom: "2px solid #94a3b8", background: isToday(d) ? "#dbeafe" : "#fff" }}>
                {d.nom.slice(0, 2)}
                <br />
                <span className="muted" style={{ fontWeight: 400 }}>{d.num}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showInd && (
          <>
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
          ).map(([label, get, color], rowIdx) => (
            <tr key={label}>
              <td style={indLeftStyle(rowIdx, "#f8fafc")}>{label}</td>
              {days.map((d, i) => (
                <td key={d.iso} style={{ ...indCellStyle(rowIdx, isToday(d) ? "#eef2ff" : "#f8fafc"), textAlign: "center", fontWeight: 700, padding: "1px 4px", color: color(i), ...sep(d) }}>
                  {get(i)}
                </td>
              ))}
            </tr>
          ))}

          {/* Bilans par categorie : presents / requis par jour (quart affiche) */}
          {CAT_BILANS.map((cat, j) => {
            const rowIdx = 3 + j;
            return (
              <tr key={cat.key}>
                <td style={{ ...indLeftStyle(rowIdx, "#f8fafc"), whiteSpace: "nowrap", fontWeight: 400 }}>{cat.label}</td>
                {days.map((d, i) => {
                  const pres = perDay[i].catPresent[cat.key] ?? 0;
                  const req = perDay[i].catRequis[cat.key] ?? 0;
                  const manque = req > 0 && pres < req;
                  const bg = manque ? "#fee2e2" : isToday(d) ? "#eef2ff" : "#f8fafc";
                  return (
                    <td
                      key={d.iso}
                      style={{ ...indCellStyle(rowIdx, bg), textAlign: "center", fontWeight: 700, padding: "1px 4px", color: manque ? "#7f1d1d" : "var(--text)", ...sep(d) }}
                      title={`${cat.label} : ${pres} présents / ${req} requis`}
                    >
                      {pres}
                      <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.7 }}>/{req}</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {/* Ligne d'alertes : puces cliquables (hors-competence / sur-effectif) */}
          <tr>
            <td style={indLeftStyle(6, "#f8fafc")}>Alertes</td>
            {days.map((d, i) => {
              const hc = perDay[i].alerts;
              const ov = perDay[i].overCount;
              const hcOn = highlight?.iso === d.iso && highlight.type === "hc";
              const ovOn = highlight?.iso === d.iso && highlight.type === "over";
              return (
                <td key={d.iso} style={{ ...indCellStyle(6, isToday(d) ? "#eef2ff" : "#f8fafc"), textAlign: "center", padding: "2px 2px", ...sep(d) }}>
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
          </>
          )}
        </tbody>
      </table>
      </div>

      {/* Tableau 2 : noms (defile, remplit le reste de la fenetre) */}
      <div className="card" style={{ marginTop: 8, overflowX: "hidden", overflowY: "auto", scrollbarGutter: "stable", flex: 1, minHeight: 0, padding: "0 12px" }}>
      <table className="matrix" style={tStyle}>
        <Cols />
        <tbody>
          {personnes.map((pers) => (
            <tr key={pers.id}>
              <td style={{ background: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: pers.color ?? "#fff",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
                    marginRight: 7,
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
                // Restriction (medicale/physique) : niveau -1 dans la matrice pour ce poste.
                const restricted = isPoste(v) && matrice[key(pers.id, v)] === -1;
                // Bouton de recopie aussi sur une case vide : permet de propager le
                // « non-affecte » sur la semaine. Masque seulement si placee sur un autre quart.
                const tpb = !!tpBlocked[key(pers.id, d.iso)];
                const tpr = tpRedirect[key(pers.id, d.iso)];
                const showFill = pers.editable && !otherByCell[key(pers.id, d.iso)] && !tpb && !tpr;
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
                      background: tpb || tpr ? "#e0e7ff" : motifColor[v] ? motifColor[v] : isToday(d) ? "#eff6ff" : undefined,
                      padding: 0,
                      position: "relative",
                      ...sep(d),
                    }}
                    title={[restricted ? "⛔ Restriction médicale/physique sur ce poste" : alert ? "Hors compétence" : "", over ? `Sur-effectif (${perDay[i].counts[v]}/${effectif[v] ?? 0})` : ""].filter(Boolean).join(" · ") || undefined}
                  >
                    {tpr ? (
                      <div className="cell-other" style={{ color: "#3730a3" }} title={`Temps partiel — travaille ${tpr === "Mat" ? "le matin" : "l'après-midi"}`}>&rarr; {tpr}</div>
                    ) : tpb ? (
                      <div className="cell-other" style={{ color: "#3730a3" }} title="Temps partiel — créneau non travaillé">TP</div>
                    ) : other ? (
                      <div className="cell-other" title={`Déjà placé sur le quart ${quartLabel[other] ?? other} ce jour-là`}>
                        &rarr; {quartLabel[other] ?? other}
                      </div>
                    ) : (
                    <button
                      type="button"
                      className={`cellbtn${isPoste(v) ? " poste" : ""}${selected === key(pers.id, d.iso) ? " sel" : ""}`}
                      disabled={!pers.editable}
                      title="Cliquer pour affecter · Suppr pour effacer"
                      onClick={(e) => {
                        const k = key(pers.id, d.iso);
                        setSelected(k);
                        if (pick && pick.pid === pers.id && pick.iso === d.iso) { setPick(null); return; }
                        const r = e.currentTarget.getBoundingClientRect();
                        setPick({ pid: pers.id, iso: d.iso, eq: pers.equipe_id, left: r.left, top: r.top, bottom: r.bottom });
                      }}
                    >
                      {valueLabel(v)}
                    </button>
                    )}
                    {showFill && (
                      <button
                        type="button"
                        className="fillw"
                        title="Copier cette valeur sur les jours suivants de la semaine"
                        onClick={() => fillWeek(pers, i)}
                      >
                        &raquo;
                      </button>
                    )}
                    {restricted && (
                      <span
                        title="Restriction médicale/physique sur ce poste"
                        style={{ position: "absolute", left: 1, top: 0, fontSize: 11, fontWeight: 800, color: "#dc2626", lineHeight: 1, pointerEvents: "none" }}
                      >
                        ✕
                      </span>
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
      </div>

      <p className="muted" style={{ margin: "6px 12px 0", fontSize: 11 }}>
        Survolez une case et cliquez sur &raquo; pour recopier sa valeur sur les
        jours suivants de la semaine (y compris « non-affecté »).{" "}
        <span className="legend-swatch hc" /> barre rouge = hors compétence ·{" "}
        <span className="legend-swatch over" /> barre jaune = sur-effectif (cumulables) ·
        cliquez une pastille de la ligne « Alertes » pour surligner les cases concernées ·{" "}
        <span style={{ background: "#1d4ed8", color: "#fff", borderRadius: 3, padding: "0 3px", fontSize: 10 }}>🕐</span> horaire
        spécifique (survolez une case placée) · jours sans ligne ouverte masqués ·{" "}
        cliquez une case puis <kbd>Suppr</kbd> pour l&apos;effacer.
      </p>

      {/* Panneau d'affectation (rendu une seule fois, position fixe -> pas de clipping). */}
      {pick && (() => {
        const cur = vals[key(pick.pid, pick.iso)] ?? "";
        const oset = new Set(openByIso[pick.iso] ?? allLigneIds);
        const og = groups.filter((g) => oset.has(g.ligneId));
        const ats: { nom: string; gs: Group[] }[] = [];
        for (const g of og) {
          const nom = g.atelierNom ?? "";
          let a = ats.find((x) => x.nom === nom);
          if (!a) { a = { nom, gs: [] }; ats.push(a); }
          a.gs.push(g);
        }
        const editable = !!persById.get(pick.pid)?.editable;
        const choose = (value: string) => { if (editable) change(pick.pid, pick.iso, pick.eq, value); setPick(null); };
        const curClosed = isPoste(cur) && !oset.has(posteLigne[cur] ?? "");
        const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const left = Math.max(8, Math.min(pick.left, vw - 360));
        const maxWidth = vw - left - 8;
        const spaceBelow = vh - pick.bottom;
        // Ouvre vers le haut si peu de place dessous (case en bas de l'ecran).
        const openUp = spaceBelow < 280 && pick.top > spaceBelow;
        const vstyle: React.CSSProperties = openUp
          ? { bottom: vh - pick.top + 2, maxHeight: Math.min(pick.top - 12, 560) }
          : { top: pick.bottom + 2, maxHeight: Math.min(spaceBelow - 12, 560) };
        return (
          <div
            className="cellpick"
            style={{ left, maxWidth, ...vstyle }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cellpick-head">
              <button type="button" className="cellpick-clear" onClick={() => choose("")}>✕ Effacer</button>
            </div>
            <div className="cellpick-body">
              {curClosed && (
                <div className="cellpick-ligne">
                  <span className="cellpick-lg">Actuel</span>
                  <span className="pick-chips"><button type="button" className="pick-chip on" onClick={() => setPick(null)}>{posteLabel[cur] ?? posteLabelAll[cur] ?? "?"}</button></span>
                </div>
              )}
              {ats.map((a) => (
                <div key={a.nom || "—"} className="cellpick-at-block">
                  {a.nom && <div className="cellpick-at">{a.nom}</div>}
                  {a.gs.map((g) => (
                    <div key={g.ligneId} className="cellpick-ligne">
                      <span className="cellpick-lg" title={g.ligneNom}>{g.ligneNom}</span>
                      <span className="pick-chips">
                        {g.postes.map((po) => (
                          <button key={po.id} type="button" className={`pick-chip${cur === po.id ? " on" : ""}`} title={po.nom} onClick={() => choose(po.id)}>{po.nom}</button>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {og.length === 0 && <div className="muted" style={{ padding: "2px 0" }}>Aucune ligne ouverte ce jour.</div>}
            </div>
            {motifs.length > 0 && (
              <div className="cellpick-abs">
                <span className="cellpick-lg">Absences</span>
                <span className="pick-chips">
                  {motifs.map((mo) => {
                    const on = cur === `m:${mo.id}`;
                    return (
                      <button
                        key={mo.id}
                        type="button"
                        className={`pick-chip${on ? " on" : ""}`}
                        style={{ borderColor: mo.couleur, background: on ? mo.couleur : undefined, color: on ? "#fff" : undefined }}
                        onClick={() => choose(`m:${mo.id}`)}
                      >
                        {mo.code}
                      </button>
                    );
                  })}
                </span>
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
}
