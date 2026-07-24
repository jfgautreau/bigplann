"use client";

import { useEffect, useRef, useState } from "react";
import { libellePeriode, etatDepart, type PeriodeAbsence } from "@/lib/absences-periodes";
import DateRangePicker from "@/components/DateRangePicker";
import ModaleDeplacable from "@/components/ModaleDeplacable";
import InfoBulle from "@/components/InfoBulle";

type Motif = { id: string; code_court: string; libelle: string; couleur: string };

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
  const [periodes, setPeriodes] = useState<PeriodeAbsence[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Une seule ligne en edition à la fois — soit un nouveau brouillon,
  // soit la modification d'une periode existante (crayon).
  const [edit, setEdit] = useState<Edition | null>(null);
  // Popovers : motif ou calendrier ouvert. La cle sert au click-outside.
  const [ouvertPop, setOuvertPop] = useState<null | "motif" | "cal">(null);
  // Conflit detecte : jours ou existe deja un placement sur poste.
  const [conflit, setConflit] = useState<{ jours: string[]; poursuivre: () => void } | null>(null);

  // Depart prevu (enregistre a la volee).
  const [dDate, setDDate] = useState(depart.date ?? "");
  const [dMotif, setDMotif] = useState(depart.motif ?? "");
  const [departEtat, setDepartEtat] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const motifById = new Map(motifs.map((m) => [m.id, m]));
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const popRef = useRef<HTMLDivElement>(null);

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

  // Click hors popover pour le refermer.
  useEffect(() => {
    if (!ouvertPop) return;
    function onDoc(e: MouseEvent) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) setOuvertPop(null);
    }
    setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ouvertPop]);

  function commencerNouveau() {
    setErreur(null);
    setEdit({ mode: "new", motif_absence_id: "", debut: "", fin: "", commentaire: "" });
  }
  function commencerEdition(p: PeriodeAbsence) {
    if (!p.absence_id) return;
    setErreur(null);
    setEdit({
      mode: "existing",
      absence_id: p.absence_id,
      motif_absence_id: p.motif_absence_id ?? "",
      debut: p.debut,
      fin: p.fin,
      commentaire: "",
    });
  }

  async function verifierEtEnregistrer() {
    if (!edit) return;
    if (!edit.motif_absence_id || !edit.debut || !edit.fin) {
      setErreur("Motif, date de début et date de fin sont requis.");
      return;
    }
    setErreur(null);
    // Preflight : y-a-t-il deja des affectations sur ces jours ?
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
        ? {
            op: "update",
            id: edit.absence_id,
            motif_absence_id: edit.motif_absence_id,
            date_debut: edit.debut,
            date_fin: edit.fin,
            commentaire: edit.commentaire,
          }
        : {
            op: "save",
            personne_id: personne.id,
            motif_absence_id: edit.motif_absence_id,
            date_debut: edit.debut,
            date_fin: edit.fin,
            commentaire: edit.commentaire,
          };
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

  async function supprimer() {
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
        body: JSON.stringify({
          op: "update",
          id: personne.id,
          patch: { date_depart_prevu: date, motif_depart: motif },
        }),
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

  // --- Rendu d'une ligne en mode edition (partagee brouillon / modification). ---
  function LigneEdition() {
    if (!edit) return null;
    const m = edit.motif_absence_id ? motifById.get(edit.motif_absence_id) : null;
    const periodeTxt = edit.debut && edit.fin
      ? libellePeriode({ motif_absence_id: null, debut: edit.debut, fin: edit.fin, jours: 0, declaree: false, absence_id: null })
      : "—";
    return (
      <>
        <tr style={{ background: "#fefce8" }}>
          <td style={cellStyle}>
            <button
              type="button"
              onClick={() => setOuvertPop(ouvertPop === "motif" ? null : "motif")}
              className="btn-sm btn-ghost"
              style={{ width: "auto", padding: "2px 8px", fontSize: 13, background: m?.couleur ?? "#f1f5f9", color: "#1f2937", fontWeight: 600, border: "1px solid var(--border)" }}
              title="Choisir le motif"
            >
              {m ? <><strong>{m.code_court}</strong> · {m.libelle}</> : <span style={{ color: "#94a3b8" }}>Choisir un motif…</span>} ▾
            </button>
          </td>
          <td style={cellStyle}>
            <button
              type="button"
              onClick={() => setOuvertPop(ouvertPop === "cal" ? null : "cal")}
              className="btn-sm btn-ghost"
              style={{ width: "auto", padding: "2px 8px", fontSize: 13, background: "#fff", border: "1px solid var(--border)", whiteSpace: "nowrap" }}
              title="Choisir la période"
            >
              {edit.debut && edit.fin ? periodeTxt : <span style={{ color: "#94a3b8" }}>Choisir les dates…</span>} 📅
            </button>
          </td>
          <td style={{ ...cellStyle, textAlign: "right" }}>
            {edit.debut && edit.fin ? Math.max(1, Math.round((Date.parse(edit.fin) - Date.parse(edit.debut)) / 86_400_000) + 1) : "—"}
          </td>
          <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
            <button type="button" className="btn-sm" disabled={enCours} onClick={verifierEtEnregistrer} style={{ width: "auto", padding: "2px 8px", fontSize: 12 }}>
              {enCours ? "…" : "Enregistrer"}
            </button>
            {edit.mode === "existing" && (
              <button type="button" className="btn-sm btn-ghost" disabled={enCours} onClick={supprimer} style={{ width: "auto", padding: "2px 8px", fontSize: 12, color: "var(--danger)" }} title="Supprimer">
                🗑
              </button>
            )}
            <button type="button" className="btn-sm btn-ghost" onClick={() => { setEdit(null); setOuvertPop(null); setErreur(null); }} style={{ width: "auto", padding: "2px 8px", fontSize: 12 }}>
              ✕
            </button>
          </td>
        </tr>
        {ouvertPop && (
          <tr>
            <td colSpan={4} style={{ padding: 0, border: "none" }}>
              <div ref={popRef} style={{ position: "relative", padding: "6px 4px 10px" }}>
                {ouvertPop === "motif" ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 6, border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }}>
                    {motifs.map((mo) => (
                      <button
                        key={mo.id}
                        type="button"
                        onClick={() => { setEdit((s) => s ? { ...s, motif_absence_id: mo.id } : s); setOuvertPop(null); }}
                        className="btn-sm btn-ghost"
                        style={{ width: "auto", padding: "3px 10px", fontSize: 13, background: mo.couleur, color: "#1f2937", fontWeight: 600, border: "1px solid #cbd5e1" }}
                      >
                        <strong>{mo.code_court}</strong> · {mo.libelle}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ maxWidth: 320 }}>
                    <DateRangePicker
                      mois={1}
                      value={{ debut: edit.debut || null, fin: edit.fin || null }}
                      onChange={(p) => {
                        setEdit((s) => s ? { ...s, debut: p.debut ?? "", fin: p.fin ?? "" } : s);
                        if (p.debut && p.fin) setOuvertPop(null);
                      }}
                    />
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <ModaleDeplacable onClose={onClose} largeur={680}>
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

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>Motif</th>
            <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>Période</th>
            <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>Jours</th>
            <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid var(--border)", width: 130 }}></th>
          </tr>
        </thead>
        <tbody>
          {edit && edit.mode === "new" && <LigneEdition />}
          {periodes === null ? (
            <tr><td colSpan={4} className="muted" style={{ padding: 10 }}>Chargement…</td></tr>
          ) : periodes.length === 0 && !edit ? (
            <tr><td colSpan={4} className="muted" style={{ padding: 10 }}>Aucune absence enregistrée pour cette personne.</td></tr>
          ) : (
            periodes.map((p, i) => {
              const enEdition = edit?.mode === "existing" && edit.absence_id === p.absence_id;
              if (enEdition) return <LigneEdition key={`edit-${p.absence_id}`} />;
              const m = p.motif_absence_id ? motifById.get(p.motif_absence_id) : null;
              return (
                <tr key={`${p.debut}-${p.motif_absence_id}-${i}`}>
                  <td style={cellStyle}>
                    <span
                      className="sexe-pill"
                      style={{ background: m?.couleur ?? "#e5e7eb", color: "#1f2937", fontWeight: 600 }}
                      title={p.declaree ? "Période déclarée" : "Saisie au planning, jour par jour"}
                    >
                      {m?.code_court ?? "?"}
                    </span>{" "}
                    {m?.libelle ?? "Motif supprimé"}
                  </td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{libellePeriode(p)}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{p.jours}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    {canEdit && p.absence_id && (
                      <button
                        type="button"
                        className="btn-sm btn-ghost"
                        onClick={() => commencerEdition(p)}
                        style={{ width: "auto", padding: "2px 8px", fontSize: 14 }}
                        title="Modifier cette période"
                      >
                        ✏️
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* ---- Départ prévu (une seule ligne pour rester cohérent avec les motifs). ---- */}
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
        <input
          type="date"
          value={dDate}
          disabled={!canEdit}
          onChange={(e) => { setDDate(e.target.value); enregistrerDepart(e.target.value, dMotif); }}
          style={{ width: "auto", padding: "3px 6px", fontSize: 13 }}
        />
        <input
          value={dMotif}
          disabled={!canEdit}
          placeholder="Retraite, démission, fin de mission…"
          onChange={(e) => setDMotif(e.target.value)}
          onBlur={() => enregistrerDepart(dDate, dMotif)}
          style={{ flex: 1, minWidth: 180, padding: "3px 6px", fontSize: 13 }}
        />
        {dDate && canEdit && (
          <button
            type="button"
            className="btn-sm btn-ghost"
            onClick={() => { setDDate(""); setDMotif(""); enregistrerDepart("", ""); }}
            style={{ width: "auto", padding: "2px 8px", fontSize: 12 }}
            title="Retirer le départ prévu"
          >
            Retirer
          </button>
        )}
        <span style={{ fontSize: 12, fontWeight: 600, color: departEtat === "error" ? "var(--danger)" : "var(--ok)" }}>
          {departEtat === "saving" ? "…" : departEtat === "saved" ? "Enregistré ✓" : departEtat === "error" ? "Échec" : ""}
        </span>
      </div>

      {/* ---- Modale conflit : des affectations existent deja sur ces jours. ---- */}
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
              {conflit.jours.map((j) => (
                <div key={j}>{j.split("-").reverse().join("/")}</div>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              Écraser remplace les affectations par l&apos;absence. Annuler ne change rien.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn-sm btn-ghost" onClick={() => setConflit(null)} style={{ width: "auto" }}>Annuler</button>
              <button type="button" className="btn-sm" onClick={conflit.poursuivre} style={{ width: "auto", background: "#dc2626", border: "1px solid #dc2626" }}>
                Écraser
              </button>
            </div>
          </div>
        </div>
      )}
    </ModaleDeplacable>
  );
}

const cellStyle: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid #f1f5f9" };
