"use client";

import { useState } from "react";

type Personne = { id: string; nom: string; prenom: string };
type Exc = {
  personne_id: string;
  jour: string;
  debut: string;
  fin: string;
  motif: string;
  label: string;
};

const fmtDate = (d: string) => (d ? d.split("-").reverse().join("/") : "—");

export default function HoraireExceptionsEditor({
  personnes,
  initial,
}: {
  personnes: Personne[];
  initial: Exc[];
}) {
  const [list, setList] = useState<Exc[]>(initial);
  const [pid, setPid] = useState("");
  const [jour, setJour] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [motif, setMotif] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const label = (id: string) => {
    const p = personnes.find((x) => x.id === id);
    return p ? `${p.nom} ${p.prenom}` : "?";
  };

  async function call(body: Record<string, unknown>) {
    const res = await fetch("/api/horaire-exception", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!pid || !jour) {
      setMsg({ kind: "err", text: "Choisissez une personne et une date." });
      return;
    }
    if (!debut && !fin) {
      setMsg({ kind: "err", text: "Renseignez au moins un début ou une fin." });
      return;
    }
    const ok = await call({ op: "save", personne_id: pid, jour, debut, fin, motif });
    if (!ok) {
      setMsg({ kind: "err", text: "Échec (droits insuffisants sur cette personne ?)." });
      return;
    }
    // Remplace une eventuelle exception existante (meme personne + jour).
    setList((l) => [
      { personne_id: pid, jour, debut, fin, motif, label: label(pid) },
      ...l.filter((x) => !(x.personne_id === pid && x.jour === jour)),
    ]);
    setDebut("");
    setFin("");
    setMotif("");
    setMsg({ kind: "ok", text: "Enregistré." });
  }

  function edit(x: Exc) {
    setPid(x.personne_id);
    setJour(x.jour);
    setDebut(x.debut);
    setFin(x.fin);
    setMotif(x.motif);
    setMsg(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(x: Exc) {
    if (!window.confirm(`Supprimer l'horaire spécifique de ${x.label} le ${fmtDate(x.jour)} ?`)) return;
    const ok = await call({ op: "delete", personne_id: x.personne_id, jour: x.jour });
    if (!ok) {
      setMsg({ kind: "err", text: "Échec de la suppression." });
      return;
    }
    setList((l) => l.filter((e) => !(e.personne_id === x.personne_id && e.jour === x.jour)));
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Ajouter / modifier</h2>
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
              <span>Date</span>
              <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} required />
            </div>
            <div className="field" style={{ flex: "0 0 110px" }}>
              <span>Début</span>
              <input type="time" value={debut} onChange={(e) => setDebut(e.target.value)} />
            </div>
            <div className="field" style={{ flex: "0 0 110px" }}>
              <span>Fin</span>
              <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <span>Motif (optionnel)</span>
              <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="ex. RDV, formation..." />
            </div>
            <button type="submit" style={{ width: "auto", padding: "9px 22px" }}>Enregistrer</button>
          </div>
          {msg && (
            <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: msg.kind === "ok" ? "var(--ok)" : "var(--danger)" }}>
              {msg.text}
            </p>
          )}
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Personne</th>
              <th>Date</th>
              <th>Début</th>
              <th>Fin</th>
              <th>Motif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={`${x.personne_id}:${x.jour}`}>
                <td>{x.label}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDate(x.jour)}</td>
                <td>{x.debut || "—"}</td>
                <td>{x.fin || "—"}</td>
                <td>{x.motif || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="btn-sm btn-ghost" title="Modifier" onClick={() => edit(x)} style={{ padding: "4px 8px" }}>✏️</button>
                  <button type="button" className="btn-sm btn-ghost" title="Supprimer" onClick={() => remove(x)} style={{ padding: "4px 8px", color: "var(--danger)" }}>🗑️</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">Aucun horaire spécifique.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
