"use client";

import { useEffect, useState } from "react";
import { libellePeriode, etatDepart, type PeriodeAbsence } from "@/lib/absences-periodes";

type Motif = { id: string; code_court: string; libelle: string; couleur: string };

// Modale « Absences » de l'écran Personnel : historique regroupé en périodes,
// déclaration d'une nouvelle absence, et départ prévu.
//
// L'historique est reconstruit à partir des JOURS d'absence (cf.
// src/lib/absences-periodes.ts) : la quasi-totalité des absences est posée jour
// par jour au Planning, sans période déclarée.
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

  // Formulaire de déclaration
  const [ouvertAjout, setOuvertAjout] = useState(false);
  const [motifId, setMotifId] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [commentaire, setCommentaire] = useState("");

  // Départ prévu (enregistré à la volée, comme le reste de l'écran)
  const [dDate, setDDate] = useState(depart.date ?? "");
  const [dMotif, setDMotif] = useState(depart.motif ?? "");
  const [departEtat, setDepartEtat] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const motifById = new Map(motifs.map((m) => [m.id, m]));
  const aujourdhui = new Date().toISOString().slice(0, 10);

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

  async function declarer() {
    if (!motifId || !debut || !fin) {
      setErreur("Motif, date de début et date de fin sont requis.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "save",
          personne_id: personne.id,
          motif_absence_id: motifId,
          date_debut: debut,
          date_fin: fin,
          commentaire,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Enregistrement refusé.");
      setOuvertAjout(false);
      setMotifId("");
      setDebut("");
      setFin("");
      setCommentaire("");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement refusé.");
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

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Absences — {personne.label}</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>✕</button>
        </div>

        {erreur && (
          <div role="alert" style={{ margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
            {erreur}
          </div>
        )}

        {/* ---- Déclaration ---- */}
        {canEdit && (
          <div style={{ marginBottom: 14 }}>
            {!ouvertAjout ? (
              <button type="button" className="btn-sm" onClick={() => setOuvertAjout(true)} style={{ width: "auto" }}>
                + Déclarer une absence
              </button>
            ) : (
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    Motif
                    <select value={motifId} onChange={(e) => setMotifId(e.target.value)} style={{ display: "block", minWidth: 170 }}>
                      <option value="">—</option>
                      {motifs.map((m) => (
                        <option key={m.id} value={m.id}>{m.libelle}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    Du
                    <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} style={{ display: "block" }} />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    Au
                    <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} style={{ display: "block" }} />
                  </label>
                </div>
                <input
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Commentaire (facultatif) — pas d'information médicale"
                  style={{ marginTop: 8, width: "100%", fontSize: 13 }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn-sm" disabled={enCours} onClick={declarer} style={{ width: "auto" }}>
                    {enCours ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <button type="button" className="btn-sm btn-ghost" onClick={() => { setOuvertAjout(false); setErreur(null); }} style={{ width: "auto" }}>
                    Annuler
                  </button>
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                  L&apos;absence remplit aussi le planning, un jour par jour de la période.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ---- Historique ---- */}
        <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Historique</h3>
        {periodes === null ? (
          <p className="muted" style={{ fontSize: 13 }}>Chargement…</p>
        ) : periodes.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Aucune absence enregistrée pour cette personne.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>Motif</th>
                <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>Période</th>
                <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>Jours</th>
              </tr>
            </thead>
            <tbody>
              {periodes.map((p, i) => {
                const m = p.motif_absence_id ? motifById.get(p.motif_absence_id) : null;
                return (
                  <tr key={`${p.debut}-${p.motif_absence_id}-${i}`}>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #f1f5f9" }}>
                      <span
                        className="sexe-pill"
                        style={{ background: m?.couleur ?? "#e5e7eb", color: "#1f2937", fontWeight: 600 }}
                        title={p.declaree ? "Période déclarée" : "Saisie au planning, jour par jour"}
                      >
                        {m?.code_court ?? "?"}
                      </span>{" "}
                      {m?.libelle ?? "Motif supprimé"}
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                      {libellePeriode(p)}
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{p.jours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ---- Départ prévu ---- */}
        <h3 style={{ margin: "18px 0 6px", fontSize: 15 }}>
          Départ prévu{" "}
          {etat === "depasse" && <span className="rbadge danger" style={{ marginLeft: 6 }}>date dépassée</span>}
        </h3>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Date à laquelle la personne quitte l&apos;effectif (retraite, démission, fin de mission).
          Le statut <strong>n&apos;est pas</strong> basculé automatiquement : la date sert d&apos;alerte,
          la désactivation reste un geste volontaire.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>
            Date
            <input
              type="date"
              value={dDate}
              disabled={!canEdit}
              onChange={(e) => { setDDate(e.target.value); enregistrerDepart(e.target.value, dMotif); }}
              style={{ display: "block" }}
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 200 }}>
            Motif
            <input
              value={dMotif}
              disabled={!canEdit}
              placeholder="Retraite, démission, fin de mission…"
              onChange={(e) => setDMotif(e.target.value)}
              onBlur={() => enregistrerDepart(dDate, dMotif)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          {dDate && canEdit && (
            <button
              type="button"
              className="btn-sm btn-ghost"
              onClick={() => { setDDate(""); setDMotif(""); enregistrerDepart("", ""); }}
              style={{ width: "auto" }}
              title="Retirer le départ prévu"
            >
              Retirer
            </button>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: departEtat === "error" ? "var(--danger)" : "var(--ok)" }}>
            {departEtat === "saving" ? "…" : departEtat === "saved" ? "Enregistré ✓" : departEtat === "error" ? "Échec" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
