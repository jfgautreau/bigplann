"use client";

import { useEffect, useRef, useState } from "react";
import { libellePeriode, etatDepart, type PeriodeAbsence } from "@/lib/absences-periodes";
import DateRangePicker from "@/components/DateRangePicker";
import ModaleDeplacable from "@/components/ModaleDeplacable";
import InfoBulle from "@/components/InfoBulle";
import { SaveIcon, TrashIcon, EditIcon } from "@/components/icons";

type Motif = { id: string; code_court: string; libelle: string; couleur: string };
type Periode = PeriodeAbsence & { commentaire: string };

// Etat d'edition d'une ligne : brouillon (nouvelle) ou modification (existante).
type Edition = {
  mode: "new" | "existing";
  absence_id?: string;
  motif_absence_id: string;
  debut: string;
  fin: string;
  commentaire: string;
};

// Modale « Absences » de l'ecran Personnel : liste des absences (regroupees par
// periodes reconstruites depuis les jours), edition inline, et depart prevu.
//
// ⚠️ Le JSX de la ligne d'edition est INLINE (pas dans une fonction imbriquee) :
// chaque re-render du parent recreerait une nouvelle reference de composant, et
// React demonterait / remonterait l'input a chaque touche — perte de focus, on
// ne pouvait plus taper dans le champ Commentaire.
export default function AbsencesModal({
  personne,
  motifs,
  depart,
  canEdit,
  onClose,
  onDepartChange,
}: {
  personne: { id: string; label: string };
  motifs: Motif[];
  depart: { date: string | null; motif: string | null };
  canEdit: boolean;
  onClose: () => void;
  onDepartChange: (d: { date: string | null; motif: string | null }) => void;
}) {
  const [periodes, setPeriodes] = useState<Periode[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [edit, setEdit] = useState<Edition | null>(null);
  const [ouvertPop, setOuvertPop] = useState<null | "motif" | "cal">(null);
  const [conflit, setConflit] = useState<{ jours: string[]; poursuivre: () => void } | null>(null);

  // Depart prevu (enregistre a la volee).
  const [dDate, setDDate] = useState(depart.date ?? "");
  const [dMotif, setDMotif] = useState(depart.motif ?? "");
  const [departEtat, setDepartEtat] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const motifById = new Map(motifs.map((m) => [m.id, m]));
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const popRef = useRef<HTMLDivElement>(null);
  // Popover ancré au bouton en `position: fixed` : la carte de la modale est en
  // `overflow: auto`, un popover `absolute` y est rogné et crée un ascenseur
  // (même piège que l'InfoBulle). On mesure le bouton au clic.
  const [popAnchor, setPopAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const openPop = (type: "motif" | "cal", e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopAnchor({ top: r.bottom + 4, left: r.left, width: r.width });
    setOuvertPop((cur) => (cur === type ? null : type));
  };
  const popStyle = (w: number): React.CSSProperties => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const left = popAnchor ? Math.max(8, Math.min(popAnchor.left, vw - w - 8)) : 0;
    return { position: "fixed", top: popAnchor?.top ?? 0, left, width: w, zIndex: 300 };
  };

  async function charger() {
    setErreur(null);
    try {
      const res = await fetch(`/api/personnel/${personne.id}/absences`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Lecture impossible.");
      setPeriodes(json.periodes ?? []);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Lecture impossible.");
      setPeriodes([]);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personne.id]);

  useEffect(() => {
    if (!ouvertPop) return;
    function onDoc(e: MouseEvent) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) setOuvertPop(null);
    }
    const onScrollResize = () => setOuvertPop(null);
    setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [ouvertPop]);

  function commencerNouveau() {
    setErreur(null);
    setEdit({ mode: "new", motif_absence_id: "", debut: "", fin: "", commentaire: "" });
  }
  function commencerEdition(p: Periode) {
    setErreur(null);
    if (p.absence_id) {
      setEdit({
        mode: "existing",
        absence_id: p.absence_id,
        motif_absence_id: p.motif_absence_id ?? "",
        debut: p.debut,
        fin: p.fin,
        commentaire: p.commentaire,
      });
    } else {
      // Periode reconstruite depuis des jours saisis au planning : re-declaree
      // via creer_absence, qui upserte les placements existants.
      setEdit({
        mode: "new",
        motif_absence_id: p.motif_absence_id ?? "",
        debut: p.debut,
        fin: p.fin,
        commentaire: "",
      });
    }
  }

  async function supprimerPeriode(p: Periode) {
    if (!canEdit) return;
    const lib = `${p.debut.split("-").reverse().join("/")}${p.debut !== p.fin ? ` → ${p.fin.split("-").reverse().join("/")}` : ""}`;
    if (!window.confirm(`Supprimer cette période d'absence (${lib}) et libérer les jours du planning ?`)) return;
    setEnCours(true);
    setErreur(null);
    try {
      const body = p.absence_id
        ? { op: "delete", id: p.absence_id }
        : {
            op: "delete-jours",
            personne_id: personne.id,
            date_debut: p.debut,
            date_fin: p.fin,
            motif_absence_id: p.motif_absence_id,
          };
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Suppression refusée.");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Suppression refusée.");
    }
    setEnCours(false);
  }

  async function verifierEtEnregistrer() {
    if (!edit) return;
    if (!edit.motif_absence_id || !edit.debut || !edit.fin) {
      setErreur("Motif, date de début et date de fin sont requis.");
      return;
    }
    setErreur(null);
    try {
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "conflits",
          personne_id: personne.id,
          date_debut: edit.debut,
          date_fin: edit.fin,
          exclure_absence_id: edit.mode === "existing" ? edit.absence_id : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Vérification impossible.");
      const jours: string[] = json.jours ?? [];
      if (jours.length > 0) {
        setConflit({ jours, poursuivre: () => { setConflit(null); enregistrer(); } });
        return;
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Vérification impossible.");
      return;
    }
    enregistrer();
  }

  async function enregistrer() {
    if (!edit) return;
    setEnCours(true);
    setErreur(null);
    try {
      const body = edit.mode === "existing"
        ? { op: "update", id: edit.absence_id, motif_absence_id: edit.motif_absence_id, date_debut: edit.debut, date_fin: edit.fin, commentaire: edit.commentaire }
        : { op: "save", personne_id: personne.id, motif_absence_id: edit.motif_absence_id, date_debut: edit.debut, date_fin: edit.fin, commentaire: edit.commentaire };
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Enregistrement refusé.");
      setEdit(null);
      setOuvertPop(null);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement refusé.");
    }
    setEnCours(false);
  }

  async function supprimerDepuisEdition() {
    if (!edit?.absence_id) return;
    if (!window.confirm("Supprimer cette période d'absence et libérer les jours du planning ?")) return;
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "delete", id: edit.absence_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Suppression refusée.");
      setEdit(null);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Suppression refusée.");
    }
    setEnCours(false);
  }

  async function enregistrerDepart(date: string, motif: string) {
    setDepartEtat("saving");
    try {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "update", id: personne.id, patch: { date_depart_prevu: date, motif_depart: motif } }),
      });
      if (!res.ok) throw new Error();
      setDepartEtat("saved");
      onDepartChange({ date: date || null, motif: motif || null });
      setTimeout(() => setDepartEtat("idle"), 1500);
    } catch {
      setDepartEtat("error");
    }
  }

  const etat = etatDepart(dDate || null, aujourdhui);

  const m = edit?.motif_absence_id ? motifById.get(edit.motif_absence_id) : null;
  const periodeTxt = edit && edit.debut && edit.fin
    ? libellePeriode({ motif_absence_id: null, debut: edit.debut, fin: edit.fin, jours: 0, declaree: false, absence_id: null })
    : "—";

  return (
    <ModaleDeplacable onClose={onClose} largeur={980}>
      <div className="mdd-drag" style={{ cursor: "move" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Absences — {personne.label}</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>✕</button>
        </div>
      </div>

      {erreur && (
        <div role="alert" style={{ margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
          {erreur}
        </div>
      )}

      {canEdit && !edit && (
        <div style={{ marginBottom: 8 }}>
          <button type="button" className="btn-sm" onClick={commencerNouveau} style={{ width: "auto" }}>
            + Déclarer une absence
          </button>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "22%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: 60 }} />
          <col />
          <col style={{ width: 110 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={hd}>Motif</th>
            <th style={hd}>Période</th>
            <th style={{ ...hd, textAlign: "right" }}>Jours</th>
            <th style={hd}>Commentaire</th>
            <th style={hd}></th>
          </tr>
        </thead>
        <tbody>
          {edit && edit.mode === "new" && (
            <RowsEdit
              edit={edit} m={m} periodeTxt={periodeTxt}
              ouvertPop={ouvertPop} openPop={openPop} popStyle={popStyle} setOuvertPop={setOuvertPop} setEdit={setEdit}
              motifs={motifs} popRef={popRef} enCours={enCours}
              onEnregistrer={verifierEtEnregistrer}
              onAnnuler={() => { setEdit(null); setOuvertPop(null); setErreur(null); }}
            />
          )}
          {periodes === null ? (
            <tr><td colSpan={5} className="muted" style={{ padding: 10 }}>Chargement…</td></tr>
          ) : periodes.length === 0 && !edit ? (
            <tr><td colSpan={5} className="muted" style={{ padding: 10 }}>Aucune absence enregistrée pour cette personne.</td></tr>
          ) : (
            periodes.map((p, i) => {
              const enEdition = edit?.mode === "existing" && edit.absence_id === p.absence_id;
              if (enEdition) {
                // Ligne d'edition inline pour une periode existante (memes cellules
                // que le brouillon, plus la corbeille).
                return (
                  <RowsEdit
                    key={`edit-${p.absence_id}`}
                    edit={edit}
                    m={m}
                    periodeTxt={periodeTxt}
                    ouvertPop={ouvertPop}
                    openPop={openPop}
                    popStyle={popStyle}
                    setOuvertPop={setOuvertPop}
                    setEdit={setEdit}
                    motifs={motifs}
                    popRef={popRef}
                    enCours={enCours}
                    onEnregistrer={verifierEtEnregistrer}
                    onSupprimer={supprimerDepuisEdition}
                    onAnnuler={() => { setEdit(null); setOuvertPop(null); setErreur(null); }}
                  />
                );
              }
              const mo = p.motif_absence_id ? motifById.get(p.motif_absence_id) : null;
              return (
                <tr key={`${p.debut}-${p.motif_absence_id}-${i}`}>
                  <td style={cell}>
                    <span className="sexe-pill" style={{ background: mo?.couleur ?? "#e5e7eb", color: "#1f2937", fontWeight: 600 }} title={p.declaree ? "Période déclarée" : "Saisie au planning, jour par jour"}>
                      {mo?.code_court ?? "?"}
                    </span>{" "}
                    {mo?.libelle ?? "Motif supprimé"}
                  </td>
                  <td style={{ ...cell, whiteSpace: "nowrap" }}>{libellePeriode(p)}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{p.jours}</td>
                  <td style={cell} className={p.commentaire ? undefined : "muted"} title={p.commentaire || undefined}>
                    {p.commentaire || (p.declaree ? "—" : "")}
                  </td>
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
                    {canEdit && (
                      <>
                        <button type="button" className="iconbtn edit" onClick={() => commencerEdition(p)} title={p.absence_id ? "Modifier" : "Modifier (re-déclare la période)"}><EditIcon /></button>
                        <button type="button" className="iconbtn del" onClick={() => supprimerPeriode(p)} title="Supprimer"><TrashIcon /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* ---- Départ prévu ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 4px", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14, display: "inline-flex", alignItems: "center" }}>
          Départ prévu
          <InfoBulle largeur={280}>
            Date à laquelle la personne quitte l&apos;effectif (retraite, démission, fin de mission).
            Le statut <strong>n&apos;est pas</strong> basculé automatiquement : la date sert d&apos;alerte,
            la désactivation reste un geste volontaire.
          </InfoBulle>
        </strong>
        {etat === "depasse" && <span className="rbadge danger">date dépassée</span>}
        <input type="date" value={dDate} disabled={!canEdit} onChange={(e) => { setDDate(e.target.value); enregistrerDepart(e.target.value, dMotif); }} style={{ width: "auto", padding: "3px 6px", fontSize: 13 }} />
        <input value={dMotif} disabled={!canEdit} placeholder="Retraite, démission, fin de mission…" onChange={(e) => setDMotif(e.target.value)} onBlur={() => enregistrerDepart(dDate, dMotif)} style={{ flex: 1, minWidth: 180, padding: "3px 6px", fontSize: 13 }} />
        {dDate && canEdit && (
          <button type="button" className="btn-sm btn-ghost" onClick={() => { setDDate(""); setDMotif(""); enregistrerDepart("", ""); }} style={{ width: "auto", padding: "2px 8px", fontSize: 12 }} title="Retirer le départ prévu">Retirer</button>
        )}
        <span style={{ fontSize: 12, fontWeight: 600, color: departEtat === "error" ? "var(--danger)" : "var(--ok)" }}>
          {departEtat === "saving" ? "…" : departEtat === "saved" ? "Enregistré ✓" : departEtat === "error" ? "Échec" : ""}
        </span>
      </div>

      {conflit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setConflit(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: "100%" }}>
            <h3 style={{ margin: "0 0 8px", color: "#b91c1c" }}>⚠ Affectations existantes</h3>
            <p style={{ marginTop: 0, fontSize: 13 }}>
              Cette personne a déjà des affectations sur poste pour{" "}
              <strong>{conflit.jours.length} jour{conflit.jours.length > 1 ? "s" : ""}</strong>{" "}
              de la période :
            </p>
            <div style={{ maxHeight: 140, overflow: "auto", fontSize: 12, padding: 8, background: "#f8fafc", borderRadius: 6, marginBottom: 12 }}>
              {conflit.jours.map((j) => (<div key={j}>{j.split("-").reverse().join("/")}</div>))}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              Écraser remplace les affectations par l&apos;absence. Annuler ne change rien.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn-sm btn-ghost" onClick={() => setConflit(null)} style={{ width: "auto" }}>Annuler</button>
              <button type="button" className="btn-sm" onClick={conflit.poursuivre} style={{ width: "auto", background: "#dc2626", border: "1px solid #dc2626" }}>Écraser</button>
            </div>
          </div>
        </div>
      )}
    </ModaleDeplacable>
  );
}

// Ligne d'édition — composant TOP-LEVEL (pas imbriqué) : sinon React démonte
// l'<input> à chaque render et le focus saute. Sert AUSSI bien au brouillon
// (« new », sans corbeille) qu'à l'édition d'une période existante (avec
// corbeille via `onSupprimer`). Popovers ancrés SOUS leur bouton.
function RowsEdit({
  edit, m, periodeTxt, ouvertPop, openPop, popStyle, setOuvertPop, setEdit, motifs, popRef, enCours,
  onEnregistrer, onSupprimer, onAnnuler,
}: {
  edit: Edition;
  m: Motif | null | undefined;
  periodeTxt: string;
  ouvertPop: null | "motif" | "cal";
  openPop: (type: "motif" | "cal", e: React.MouseEvent) => void;
  popStyle: (w: number) => React.CSSProperties;
  setOuvertPop: (v: null | "motif" | "cal") => void;
  setEdit: React.Dispatch<React.SetStateAction<Edition | null>>;
  motifs: Motif[];
  popRef: React.RefObject<HTMLDivElement | null>;
  enCours: boolean;
  onEnregistrer: () => void;
  onSupprimer?: () => void;
  onAnnuler: () => void;
}) {
  const trigger: React.CSSProperties = { width: "100%", margin: 0, padding: "4px 8px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 7, textAlign: "left", cursor: "pointer" };
  return (
    <tr style={{ background: "#fefce8" }}>
      <td style={cell}>
        <button type="button" onClick={(e) => openPop("motif", e)} onMouseDown={(e) => e.stopPropagation()}
          style={{ ...trigger, background: m?.couleur ?? "#f1f5f9", color: "#1f2937", fontWeight: 600 }} title="Choisir le motif">
          {m ? <><strong>{m.code_court}</strong> · {m.libelle}</> : <span style={{ color: "#94a3b8" }}>Motif…</span>} ▾
        </button>
        {ouvertPop === "motif" && (
          <div ref={popRef} style={popStyle(280)}>
            <div className="picklist" style={{ boxShadow: "0 8px 24px rgba(15,23,42,.18)" }}>
              {motifs.map((mo) => (
                <button key={mo.id} type="button" className="picklist-item"
                  onClick={() => { setEdit((s) => s ? { ...s, motif_absence_id: mo.id } : s); setOuvertPop(null); }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: mo.couleur || "#cbd5e1", border: "1px solid #cbd5e1", flex: "0 0 auto" }} />
                  <strong style={{ minWidth: 44 }}>{mo.code_court}</strong>
                  <span>{mo.libelle}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </td>
      <td style={cell}>
        <button type="button" onClick={(e) => openPop("cal", e)} onMouseDown={(e) => e.stopPropagation()}
          style={{ ...trigger, background: "#fff", color: "#1f2937", whiteSpace: "nowrap" }} title="Choisir la période">
          {edit.debut && edit.fin ? periodeTxt : <span style={{ color: "#94a3b8" }}>Dates…</span>} 📅
        </button>
        {ouvertPop === "cal" && (
          <div ref={popRef} style={{ ...popStyle(544), boxShadow: "0 8px 24px rgba(15,23,42,.18)", borderRadius: 10 }}>
            <DateRangePicker
              mois={2}
              value={{ debut: edit.debut || null, fin: edit.fin || null }}
              onChange={(p) => {
                setEdit((s) => s ? { ...s, debut: p.debut ?? "", fin: p.fin ?? "" } : s);
                if (p.debut && p.fin) setOuvertPop(null);
              }}
            />
          </div>
        )}
      </td>
      <td style={{ ...cell, textAlign: "right" }}>
        {edit.debut && edit.fin ? Math.max(1, Math.round((Date.parse(edit.fin) - Date.parse(edit.debut)) / 86_400_000) + 1) : "—"}
      </td>
      <td style={cell}>
        <input
          value={edit.commentaire}
          onChange={(e) => setEdit((s) => s ? { ...s, commentaire: e.target.value } : s)}
          placeholder="Commentaire — pas d'info médicale"
          style={{ width: "100%", fontSize: 13, padding: "3px 6px" }}
        />
      </td>
      <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
        <button type="button" className="iconbtn save" disabled={enCours} onClick={onEnregistrer} title="Enregistrer">
          {enCours ? "…" : <SaveIcon />}
        </button>
        {onSupprimer && (
          <button type="button" className="iconbtn del" disabled={enCours} onClick={onSupprimer} title="Supprimer"><TrashIcon /></button>
        )}
        <button type="button" className="iconbtn ghost" onClick={onAnnuler} title="Annuler">✕</button>
      </td>
    </tr>
  );
}

const cell: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid #f1f5f9" };
const hd: React.CSSProperties = { textAlign: "left", padding: "4px 6px", borderBottom: "1px solid var(--border)" };
