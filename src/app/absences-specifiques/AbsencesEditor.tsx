"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import { libellePeriode } from "@/lib/absences-periodes";

type Personne = { id: string; nom: string; prenom: string; atelier_id: string | null };
type Atelier = { id: string; nom: string };
type Motif = { id: string; code_court: string; libelle: string; couleur: string };
type Abs = {
  id: string;
  personne_id: string;
  motif_absence_id: string;
  date_debut: string;
  date_fin: string;
  commentaire: string;
  label: string;
};

// Etat d'edition d'une ligne — brouillon (« + Declarer ») ou modification (crayon).
type Edition = {
  mode: "new" | "existing";
  absence_id?: string;
  personne_id: string;
  motif_absence_id: string;
  debut: string;
  fin: string;
  commentaire: string;
};

const fmtDate = (d: string) => (d ? d.split("-").reverse().join("/") : "—");
const nbJours = (a: string, b: string) => (a && b ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1) : 0);
const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Editeur unifie « Absences » du menu Planning : meme UX que la modale Personnel
// (ligne inline avec palette motif + mini calendrier + commentaire, crayon +
// corbeille sur chaque ligne, verification de conflit avant enregistrement),
// enrichi de la selection de la personne (le contexte n'est pas fige) et de
// filtres nom / atelier / periode.
export default function AbsencesEditor({
  personnes,
  motifs,
  ateliers,
  initial,
}: {
  personnes: Personne[];
  motifs: Motif[];
  ateliers: Atelier[];
  initial: Abs[];
}) {
  const [list, setList] = useState<Abs[]>(initial);
  const [edit, setEdit] = useState<Edition | null>(null);
  // Popovers d'edition. `personne` en plus car il faut la selectionner ici.
  const [ouvertPop, setOuvertPop] = useState<null | "motif" | "cal" | "personne">(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [conflit, setConflit] = useState<{ jours: string[]; poursuivre: () => void } | null>(null);

  // Filtres (nom + atelier + periode d'intersection).
  const [fNom, setFNom] = useState("");
  const [fAtelier, setFAtelier] = useState("");
  const [fDu, setFDu] = useState("");
  const [fAu, setFAu] = useState("");

  const popRef = useRef<HTMLDivElement>(null);
  const persById = useMemo(() => new Map(personnes.map((p) => [p.id, p])), [personnes]);
  const motifById = useMemo(() => new Map(motifs.map((m) => [m.id, m])), [motifs]);

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
    setOk(null);
    setEdit({ mode: "new", personne_id: "", motif_absence_id: "", debut: "", fin: "", commentaire: "" });
  }
  function commencerEdition(a: Abs) {
    setErreur(null);
    setOk(null);
    setEdit({
      mode: "existing",
      absence_id: a.id,
      personne_id: a.personne_id,
      motif_absence_id: a.motif_absence_id,
      debut: a.date_debut,
      fin: a.date_fin,
      commentaire: a.commentaire,
    });
  }
  function annulerEdition() {
    setEdit(null);
    setOuvertPop(null);
    setErreur(null);
  }

  async function verifierEtEnregistrer() {
    if (!edit) return;
    if (!edit.personne_id || !edit.motif_absence_id || !edit.debut || !edit.fin) {
      setErreur("Personne, motif, date de début et date de fin sont requis.");
      return;
    }
    setErreur(null);
    try {
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "conflits",
          personne_id: edit.personne_id,
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
            personne_id: edit.personne_id,
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
      const label = persById.get(edit.personne_id);
      const labelStr = label ? `${label.nom} ${label.prenom}` : "?";
      if (edit.mode === "existing" && edit.absence_id) {
        setList((l) =>
          l.map((x) =>
            x.id === edit.absence_id
              ? { ...x, motif_absence_id: edit.motif_absence_id, date_debut: edit.debut, date_fin: edit.fin, commentaire: edit.commentaire }
              : x
          )
        );
      } else if (json.row?.id) {
        setList((l) => [
          {
            id: json.row.id,
            personne_id: edit.personne_id,
            motif_absence_id: edit.motif_absence_id,
            date_debut: edit.debut,
            date_fin: edit.fin,
            commentaire: edit.commentaire,
            label: labelStr,
          },
          ...l,
        ]);
      }
      setEdit(null);
      setOuvertPop(null);
      setOk("Enregistré ✓");
      setTimeout(() => setOk(null), 2000);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement refusé.");
    }
    setEnCours(false);
  }

  async function supprimer(a: Abs) {
    if (!window.confirm(`Supprimer l'absence de ${a.label} (${fmtDate(a.date_debut)}${a.date_debut !== a.date_fin ? ` → ${fmtDate(a.date_fin)}` : ""}) ?\nLes jours seront libérés dans le planning.`)) return;
    setErreur(null);
    try {
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "delete", id: a.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Suppression refusée.");
      setList((l) => l.filter((x) => x.id !== a.id));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Suppression refusée.");
    }
  }

  // Filtrage : nom (contient), atelier (personne rattachee — pas d'atelier :
  // toujours visible), periode d'intersection.
  //   fDu et/ou fAu vides = borne ouverte, comme un filtre habituel.
  //   fDu seul  -> absences se terminant apres fDu
  //   fAu seul  -> absences commencant avant fAu
  //   fDu+fAu   -> absences dont la plage recouvre [fDu, fAu]
  const filtered = useMemo(() => {
    const q = norm(fNom.trim());
    return list.filter((a) => {
      if (q && !norm(a.label).includes(q)) return false;
      if (fAtelier) {
        const p = persById.get(a.personne_id);
        if (!p) return false;
        if (p.atelier_id !== fAtelier) return false;
      }
      if (fDu && a.date_fin < fDu) return false;
      if (fAu && a.date_debut > fAu) return false;
      return true;
    });
  }, [list, fNom, fAtelier, fDu, fAu, persById]);

  const MotifChip = ({ id }: { id: string }) => {
    const m = motifById.get(id);
    if (!m) return <span className="muted">—</span>;
    return (
      <span className="sexe-pill" style={{ background: m.couleur || "#e5e7eb", color: "#1f2937", fontWeight: 600 }} title={m.libelle}>
        {m.code_court}
      </span>
    );
  };

  const cellStyle: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid #f1f5f9" };

  // Options du menu Personne (dropdown de la ligne d'edition).
  const persOptions = useMemo(
    () => [...personnes].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`)),
    [personnes]
  );

  function LigneEdition() {
    if (!edit) return null;
    const pers = edit.personne_id ? persById.get(edit.personne_id) : null;
    const m = edit.motif_absence_id ? motifById.get(edit.motif_absence_id) : null;
    const periodeTxt = edit.debut && edit.fin
      ? libellePeriode({ motif_absence_id: null, debut: edit.debut, fin: edit.fin, jours: 0, declaree: false, absence_id: null })
      : "—";
    return (
      <>
        <tr style={{ background: "#fefce8" }}>
          <td style={cellStyle}>
            {edit.mode === "existing" ? (
              // Changer la personne d'une absence deja saisie casserait le lien
              // (le RPC ne prend pas de personne_id en update). On la fige.
              <span title="Personne non modifiable après création — supprimer et recréer si besoin.">
                <strong>{pers ? `${pers.nom} ${pers.prenom}` : "?"}</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setOuvertPop(ouvertPop === "personne" ? null : "personne")}
                className="btn-sm btn-ghost"
                style={{ width: "auto", padding: "2px 8px", fontSize: 13, background: "#fff", border: "1px solid var(--border)" }}
                title="Choisir la personne"
              >
                {pers ? `${pers.nom} ${pers.prenom}` : <span style={{ color: "#94a3b8" }}>Choisir une personne…</span>} ▾
              </button>
            )}
          </td>
          <td style={cellStyle}>
            <button
              type="button"
              onClick={() => setOuvertPop(ouvertPop === "motif" ? null : "motif")}
              className="btn-sm btn-ghost"
              style={{ width: "auto", padding: "2px 8px", fontSize: 13, background: m?.couleur ?? "#f1f5f9", color: "#1f2937", fontWeight: 600, border: "1px solid var(--border)" }}
              title="Choisir le motif"
            >
              {m ? <><strong>{m.code_court}</strong> · {m.libelle}</> : <span style={{ color: "#94a3b8" }}>Motif…</span>} ▾
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
              {edit.debut && edit.fin ? periodeTxt : <span style={{ color: "#94a3b8" }}>Dates…</span>} 📅
            </button>
          </td>
          <td style={{ ...cellStyle, textAlign: "right" }}>
            {edit.debut && edit.fin ? nbJours(edit.debut, edit.fin) : "—"}
          </td>
          <td style={cellStyle}>
            <input
              value={edit.commentaire}
              onChange={(e) => setEdit((s) => s ? { ...s, commentaire: e.target.value } : s)}
              placeholder="Commentaire — pas d'info médicale"
              style={{ width: "100%", fontSize: 13, padding: "2px 6px" }}
            />
          </td>
          <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
            <button type="button" className="btn-sm" disabled={enCours} onClick={verifierEtEnregistrer} style={{ width: "auto", padding: "2px 8px", fontSize: 12 }}>
              {enCours ? "…" : "Enregistrer"}
            </button>
            <button type="button" className="btn-sm btn-ghost" onClick={annulerEdition} style={{ width: "auto", padding: "2px 8px", fontSize: 12 }} title="Annuler">
              ✕
            </button>
          </td>
        </tr>
        {ouvertPop && (
          <tr>
            <td colSpan={6} style={{ padding: 0, border: "none" }}>
              <div ref={popRef} style={{ position: "relative", padding: "6px 4px 10px" }}>
                {ouvertPop === "personne" ? (
                  <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "#fff", padding: 4 }}>
                    {persOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setEdit((s) => s ? { ...s, personne_id: p.id } : s); setOuvertPop(null); }}
                        className="btn-sm btn-ghost"
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "3px 8px", fontSize: 13 }}
                      >
                        {p.nom} {p.prenom}
                      </button>
                    ))}
                  </div>
                ) : ouvertPop === "motif" ? (
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
    <div>
      {/* --- Filtres --- */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <span>Nom</span>
            <input value={fNom} onChange={(e) => setFNom(e.target.value)} placeholder="🔍 rechercher un nom" />
          </div>
          <div className="field" style={{ flex: "0 0 200px" }}>
            <span>Atelier</span>
            <select value={fAtelier} onChange={(e) => setFAtelier(e.target.value)}>
              <option value="">Tous ateliers</option>
              {ateliers.map((a) => (<option key={a.id} value={a.id}>{a.nom}</option>))}
            </select>
          </div>
          <div className="field" style={{ flex: "0 0 160px" }}>
            <span>Période — du</span>
            <input type="date" value={fDu} onChange={(e) => setFDu(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "0 0 160px" }}>
            <span>… au</span>
            <input type="date" value={fAu} onChange={(e) => setFAu(e.target.value)} />
          </div>
          {(fNom || fAtelier || fDu || fAu) && (
            <button
              type="button"
              className="btn-sm btn-ghost"
              style={{ width: "auto", padding: "6px 12px", marginBottom: 2 }}
              onClick={() => { setFNom(""); setFAtelier(""); setFDu(""); setFAu(""); }}
            >
              Effacer
            </button>
          )}
          <span className="muted" style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600 }}>
            {filtered.length === list.length ? `${list.length} absence${list.length > 1 ? "s" : ""}` : `${filtered.length} / ${list.length}`}
          </span>
        </div>
      </div>

      {/* --- Actions + bandeau --- */}
      {erreur && (
        <div role="alert" style={{ margin: "0 0 10px", padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
          {erreur}
          <button type="button" onClick={() => setErreur(null)} style={{ float: "right", background: "transparent", border: "none", color: "#991b1b", cursor: "pointer", width: "auto", margin: 0, padding: 0, fontSize: 14 }}>✕</button>
        </div>
      )}
      {ok && <div style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "var(--ok)" }}>{ok}</div>}

      {!edit && (
        <div style={{ marginBottom: 8 }}>
          <button type="button" className="btn-sm" onClick={commencerNouveau} style={{ width: "auto" }}>
            + Déclarer une absence
          </button>
        </div>
      )}

      {/* --- Table --- */}
      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px" }}>Personne</th>
              <th style={{ textAlign: "left", padding: "6px" }}>Motif</th>
              <th style={{ textAlign: "left", padding: "6px" }}>Période</th>
              <th style={{ textAlign: "right", padding: "6px", width: 60 }}>Jours</th>
              <th style={{ textAlign: "left", padding: "6px" }}>Commentaire</th>
              <th style={{ padding: "6px", width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {edit && edit.mode === "new" && <LigneEdition />}
            {filtered.map((a) => {
              const enEdition = edit?.mode === "existing" && edit.absence_id === a.id;
              if (enEdition) return <LigneEdition key={`edit-${a.id}`} />;
              return (
                <tr key={a.id}>
                  <td style={cellStyle}>{a.label}</td>
                  <td style={cellStyle}><MotifChip id={a.motif_absence_id} /></td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    {a.date_debut === a.date_fin ? fmtDate(a.date_debut) : `${fmtDate(a.date_debut)} → ${fmtDate(a.date_fin)}`}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{nbJours(a.date_debut, a.date_fin)}</td>
                  <td style={cellStyle} className={a.commentaire ? undefined : "muted"}>{a.commentaire || "—"}</td>
                  <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button type="button" className="btn-sm btn-ghost" onClick={() => commencerEdition(a)} style={{ width: "auto", padding: "2px 6px", fontSize: 14 }} title="Modifier">✏️</button>
                    <button type="button" className="btn-sm btn-ghost" onClick={() => supprimer(a)} style={{ width: "auto", padding: "2px 6px", fontSize: 14, color: "var(--danger)" }} title="Supprimer">🗑</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !edit && (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 10 }}>
                  {list.length === 0 ? "Aucune absence enregistrée." : "Aucun résultat pour ces filtres."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- Conflit --- */}
      {conflit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setConflit(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: "100%" }}>
            <h3 style={{ margin: "0 0 8px", color: "#b91c1c" }}>⚠ Affectations existantes</h3>
            <p style={{ marginTop: 0, fontSize: 13 }}>
              La personne a déjà des affectations sur poste pour{" "}
              <strong>{conflit.jours.length} jour{conflit.jours.length > 1 ? "s" : ""}</strong>{" "}
              de la période :
            </p>
            <div style={{ maxHeight: 140, overflow: "auto", fontSize: 12, padding: 8, background: "#f8fafc", borderRadius: 6, marginBottom: 12 }}>
              {conflit.jours.map((j) => (<div key={j}>{fmtDate(j)}</div>))}
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
    </div>
  );
}
