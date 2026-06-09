"use client";

import { useState } from "react";

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
  const [pid, setPid] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [motif, setMotif] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const persLabel = (id: string) => {
    const p = personnes.find((x) => x.id === id);
    return p ? `${p.nom} ${p.prenom}` : "?";
  };
  const motifOf = (id: string) => motifs.find((m) => m.id === id);

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td>{a.label}</td>
                <td><MotifChip id={a.motif_absence_id} /></td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDate(a.date_debut)}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDate(a.date_fin)}</td>
                <td style={{ textAlign: "center" }}>{nbJours(a.date_debut, a.date_fin)}</td>
                <td className="muted">{a.commentaire || "—"}</td>
                <td><button type="button" className="btn-sm btn-ghost" onClick={() => remove(a)}>Supprimer</button></td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="muted">Aucune absence enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
