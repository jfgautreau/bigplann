"use client";

import { useMemo, useState } from "react";

type Personne = { id: string; nom: string; prenom: string };
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

const fmtDate = (d: string) => (d ? d.split("-").reverse().join("/") : "—");
const nbJours = (a: string, b: string) => {
  if (!a || !b) return 0;
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1;
};

export default function AbsencesEditor({
  personnes,
  motifs,
  initial,
}: {
  personnes: Personne[];
  motifs: Motif[];
  initial: Abs[];
}) {
  const [list, setList] = useState<Abs[]>(initial);
  // Formulaire d'ajout
  const [pid, setPid] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [motif, setMotif] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Edition en ligne (crayon -> validation)
  const [editId, setEditId] = useState<string | null>(null);
  const [ed, setEd] = useState<{ motif: string; debut: string; fin: string; commentaire: string }>({ motif: "", debut: "", fin: "", commentaire: "" });

  // Filtres en en-tete de colonne
  const [f, setF] = useState({ personne: "", motif: "", du: "", au: "", commentaire: "" });

  const persLabel = (id: string) => {
    const p = personnes.find((x) => x.id === id);
    return p ? `${p.nom} ${p.prenom}` : "?";
  };
  const motifOf = (id: string) => motifs.find((m) => m.id === id);
  const motifText = (id: string) => {
    const m = motifOf(id);
    return m ? `${m.code_court} ${m.libelle}` : "";
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!pid || !debut || !fin || !motif) {
      setMsg({ kind: "err", text: "Personne, dates et motif sont requis." });
      return;
    }
    if (fin < debut) {
      setMsg({ kind: "err", text: "La date de fin doit être après la date de début." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "save", personne_id: pid, date_debut: debut, date_fin: fin, motif_absence_id: motif, commentaire }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; row?: { id: string }; error?: string };
      if (!res.ok || !j.row) {
        setMsg({ kind: "err", text: j.error || "Échec (droits insuffisants sur cette personne ?)." });
        return;
      }
      setList((l) => [
        { id: j.row!.id, personne_id: pid, motif_absence_id: motif, date_debut: debut, date_fin: fin, commentaire, label: persLabel(pid) },
        ...l,
      ]);
      setDebut("");
      setFin("");
      setCommentaire("");
      setMsg({ kind: "ok", text: "Absence enregistrée et reportée dans le planning." });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(a: Abs) {
    setEditId(a.id);
    setEd({ motif: a.motif_absence_id, debut: a.date_debut, fin: a.date_fin, commentaire: a.commentaire });
    setMsg(null);
  }
  function cancelEdit() {
    setEditId(null);
  }
  async function saveEdit(a: Abs) {
    if (!ed.motif || !ed.debut || !ed.fin) {
      setMsg({ kind: "err", text: "Dates et motif requis." });
      return;
    }
    if (ed.fin < ed.debut) {
      setMsg({ kind: "err", text: "La date de fin doit être après la date de début." });
      return;
    }
    const res = await fetch("/api/absence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "update", id: a.id, motif_absence_id: ed.motif, date_debut: ed.debut, date_fin: ed.fin, commentaire: ed.commentaire }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg({ kind: "err", text: j.error || "Échec de la modification." });
      return;
    }
    setList((l) => l.map((x) => (x.id === a.id ? { ...x, motif_absence_id: ed.motif, date_debut: ed.debut, date_fin: ed.fin, commentaire: ed.commentaire } : x)));
    setEditId(null);
    setMsg({ kind: "ok", text: "Absence modifiée." });
  }

  async function remove(a: Abs) {
    if (!window.confirm(`Supprimer l'absence de ${a.label} du ${fmtDate(a.date_debut)} au ${fmtDate(a.date_fin)} ?\nLe motif sera retiré de ces jours dans le planning.`)) return;
    const res = await fetch("/api/absence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "delete", id: a.id }),
    });
    if (!res.ok) {
      setMsg({ kind: "err", text: "Échec de la suppression." });
      return;
    }
    setList((l) => l.filter((x) => x.id !== a.id));
  }

  const filtered = useMemo(() => {
    const inc = (h: string, n: string) => h.toLowerCase().includes(n.trim().toLowerCase());
    return list.filter((a) =>
      (!f.personne || inc(a.label, f.personne)) &&
      (!f.motif || inc(motifText(a.motif_absence_id), f.motif)) &&
      (!f.du || inc(fmtDate(a.date_debut), f.du)) &&
      (!f.au || inc(fmtDate(a.date_fin), f.au)) &&
      (!f.commentaire || inc(a.commentaire || "", f.commentaire))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, f, motifs]);

  const MotifChip = ({ id }: { id: string }) => {
    const m = motifOf(id);
    if (!m) return <span className="muted">—</span>;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: m.couleur || "#cbd5e1", display: "inline-block" }} />
        <strong>{m.code_court}</strong> <span className="muted">{m.libelle}</span>
      </span>
    );
  };

  const filterInput = (key: keyof typeof f) => (
    <input
      value={f[key]}
      onChange={(e) => setF((s) => ({ ...s, [key]: e.target.value }))}
      placeholder="🔍"
      style={{ width: "100%", fontSize: 11, fontWeight: 400, padding: "2px 4px" }}
    />
  );
  const edInp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "2px 4px" };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Ajouter une absence</h2>
        <form onSubmit={add} autoComplete="off">
          <div className="toolbar" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 220px" }}>
              <span>Personne</span>
              <select value={pid} onChange={(e) => setPid(e.target.value)} required>
                <option value="">Choisir...</option>
                {personnes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: "0 0 150px" }}>
              <span>Début</span>
              <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} required />
            </div>
            <div className="field" style={{ flex: "0 0 150px" }}>
              <span>Fin</span>
              <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} required />
            </div>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <span>Motif d&apos;absence</span>
              <select value={motif} onChange={(e) => setMotif(e.target.value)} required>
                <option value="">Choisir...</option>
                {motifs.map((m) => (
                  <option key={m.id} value={m.id}>{m.code_court} — {m.libelle}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <span>Commentaire (pas d&apos;info médicale)</span>
              <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
            </div>
            <button type="submit" disabled={busy} style={{ width: "auto", padding: "9px 22px" }}>
              {busy ? "..." : "Enregistrer"}
            </button>
          </div>
          {debut && fin && fin >= debut && (
            <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              {nbJours(debut, fin)} jour(s) seront marqués absents.
            </p>
          )}
          {msg && (
            <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: msg.kind === "ok" ? "var(--ok)" : "var(--danger)" }}>{msg.text}</p>
          )}
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Personne</th>
              <th>Motif</th>
              <th>Du</th>
              <th>Au</th>
              <th style={{ textAlign: "center" }}>Jours</th>
              <th>Commentaire</th>
              <th style={{ width: 90 }}></th>
            </tr>
            <tr>
              <th style={{ padding: "2px 4px" }}>{filterInput("personne")}</th>
              <th style={{ padding: "2px 4px" }}>{filterInput("motif")}</th>
              <th style={{ padding: "2px 4px" }}>{filterInput("du")}</th>
              <th style={{ padding: "2px 4px" }}>{filterInput("au")}</th>
              <th></th>
              <th style={{ padding: "2px 4px" }}>{filterInput("commentaire")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const editing = editId === a.id;
              return (
                <tr key={a.id}>
                  <td>{a.label}</td>
                  <td>
                    {editing ? (
                      <select value={ed.motif} onChange={(e) => setEd((s) => ({ ...s, motif: e.target.value }))} style={edInp}>
                        <option value="">Choisir...</option>
                        {motifs.map((m) => (<option key={m.id} value={m.id}>{m.code_court} — {m.libelle}</option>))}
                      </select>
                    ) : (
                      <MotifChip id={a.motif_absence_id} />
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {editing ? (
                      <input type="date" value={ed.debut} onChange={(e) => setEd((s) => ({ ...s, debut: e.target.value }))} style={edInp} />
                    ) : fmtDate(a.date_debut)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {editing ? (
                      <input type="date" value={ed.fin} onChange={(e) => setEd((s) => ({ ...s, fin: e.target.value }))} style={edInp} />
                    ) : fmtDate(a.date_fin)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {editing ? nbJours(ed.debut, ed.fin) : nbJours(a.date_debut, a.date_fin)}
                  </td>
                  <td className="muted">
                    {editing ? (
                      <input value={ed.commentaire} onChange={(e) => setEd((s) => ({ ...s, commentaire: e.target.value }))} style={edInp} />
                    ) : (a.commentaire || "—")}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {editing ? (
                      <>
                        <button type="button" className="btn-sm" title="Enregistrer" onClick={() => saveEdit(a)} style={{ padding: "4px 8px" }}>✓</button>
                        <button type="button" className="btn-sm btn-ghost" title="Annuler" onClick={cancelEdit} style={{ padding: "4px 8px" }}>×</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn-sm btn-ghost" title="Modifier sur la ligne" onClick={() => startEdit(a)} style={{ padding: "4px 8px" }}>✏️</button>
                        <button type="button" className="btn-sm btn-ghost" title="Supprimer" onClick={() => remove(a)} style={{ padding: "4px 8px", color: "var(--danger)" }}>🗑️</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="muted">{list.length === 0 ? "Aucune absence enregistrée." : "Aucun résultat pour ces filtres."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
