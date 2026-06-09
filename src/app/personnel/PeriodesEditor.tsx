"use client";

import { useEffect, useRef, useState } from "react";

type Periode = {
  id: string;
  personne_id: string;
  type_contrat: string;
  agence_interim: string | null;
  date_debut: string | null;
  date_fin: string | null;
  motif: string | null;
  commentaire: string | null;
};

const CONTRATS = ["CDI", "CDD", "INTERIM"];

export default function PeriodesEditor({ personneId }: { personneId: string }) {
  const [rows, setRows] = useState<Periode[]>([]);
  const [loading, setLoading] = useState(true);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function post(op: string, payload: Record<string, unknown>) {
    setSave("saving");
    try {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...payload }),
      });
      if (!res.ok) throw new Error();
      setSave("saved");
      return (await res.json().catch(() => ({}))) as { ok?: boolean; row?: Periode; rows?: Periode[] };
    } catch {
      setSave("error");
      return null;
    } finally {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSave("idle"), 1500);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "periode-list", personne_id: personneId }),
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
  }, [personneId]);

  function patchLocal(id: string, p: Partial<Periode>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  function edit(id: string, key: keyof Periode, value: string, instant = false) {
    patchLocal(id, { [key]: value } as Partial<Periode>);
    const k = `${id}:${key}`;
    if (timers.current[k]) clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(
      () => post("periode-update", { id, personne_id: personneId, patch: { [key]: value } }),
      instant ? 0 : 500
    );
  }

  async function add() {
    const j = await post("periode-create", { personne_id: personneId, type_contrat: "INTERIM" });
    if (j?.row) setRows((rs) => [...rs, j.row as Periode]);
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette période de contrat ?")) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
    await post("periode-delete", { id, personne_id: personneId });
  }

  const th: React.CSSProperties = { textAlign: "left", padding: "4px 8px", fontSize: 12, color: "var(--muted)" };
  const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "4px 6px" };

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Contrats / périodes</h2>
        <span style={{ fontSize: 12, fontWeight: 600, color: save === "error" ? "var(--danger)" : save === "saved" ? "var(--ok)" : "var(--muted)" }}>
          {save === "saving" ? "Enregistrement…" : save === "saved" ? "Enregistré ✓" : save === "error" ? "Échec" : ""}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Historique complet des contrats. La <strong>fin du contrat le plus récent</strong> est ce qui s&apos;affiche dans la liste Personnel.
      </p>

      {loading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 130 }}>Type</th>
              <th style={{ ...th, width: 200 }}>Agence (si intérim)</th>
              <th style={{ ...th, width: 150 }}>Début</th>
              <th style={{ ...th, width: 150 }}>Fin</th>
              <th style={{ ...th, width: 180 }}>Motif</th>
              <th style={th}>Commentaire</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <select value={r.type_contrat} onChange={(e) => edit(r.id, "type_contrat", e.target.value, true)} style={inp}>
                    {CONTRATS.map((c) => (
                      <option key={c} value={c}>{c === "INTERIM" ? "Intérim" : c}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={r.agence_interim ?? ""}
                    disabled={r.type_contrat !== "INTERIM"}
                    onChange={(e) => edit(r.id, "agence_interim", e.target.value)}
                    style={{ ...inp, opacity: r.type_contrat !== "INTERIM" ? 0.5 : 1 }}
                  />
                </td>
                <td><input type="date" value={r.date_debut ?? ""} onChange={(e) => edit(r.id, "date_debut", e.target.value, true)} style={inp} /></td>
                <td><input type="date" value={r.date_fin ?? ""} onChange={(e) => edit(r.id, "date_fin", e.target.value, true)} style={inp} /></td>
                <td><input value={r.motif ?? ""} onChange={(e) => edit(r.id, "motif", e.target.value)} placeholder="ex. remplacement, surcroît…" style={inp} /></td>
                <td><input value={r.commentaire ?? ""} onChange={(e) => edit(r.id, "commentaire", e.target.value)} style={inp} /></td>
                <td style={{ textAlign: "center" }}>
                  <button type="button" className="btn-sm btn-ghost" onClick={() => remove(r.id)} title="Supprimer cette période" style={{ color: "var(--danger)" }}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">Aucune période. Ajoutez-en une.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <button type="button" onClick={add} style={{ width: "auto", marginTop: 10, padding: "8px 16px" }}>
        + Ajouter une période
      </button>
    </div>
  );
}
