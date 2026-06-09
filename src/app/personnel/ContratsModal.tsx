"use client";

import { useEffect, useState } from "react";

type Periode = {
  id: string;
  type_contrat: string;
  agence_interim: string | null;
  date_debut: string | null;
  date_fin: string | null;
  motif: string | null;
  commentaire: string | null;
};

const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const contratLabel = (t: string) => (t === "INTERIM" ? "Intérim" : t);

export default function ContratsModal({ personne, onClose }: { personne: { id: string; label: string }; onClose: () => void }) {
  const [rows, setRows] = useState<Periode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "periode-list", personne_id: personne.id }),
      });
      const j = (await res.json().catch(() => ({}))) as { rows?: Periode[] };
      if (!cancelled) {
        setRows(j.rows ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personne.id]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Contrats — {personne.label}</h2>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>✕</button>
        </div>
        {loading ? (
          <p className="muted">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="muted">Aucune période de contrat enregistrée.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Motif</th>
                <th>Agence</th>
                <th>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{contratLabel(r.type_contrat)}</strong></td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date_debut)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date_fin)}</td>
                  <td>{r.motif || <span className="muted">—</span>}</td>
                  <td>{r.agence_interim || <span className="muted">—</span>}</td>
                  <td className="muted">{r.commentaire || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
