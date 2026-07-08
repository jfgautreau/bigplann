"use client";

import { useRef, useState } from "react";
import ToggleSwitch from "@/components/ToggleSwitch";

type Row = {
  id: string;
  nom: string;
  categorie: string | null;
  groupe: string | null;
  duree_validite_mois: number | null;
  a_autorisation_conduite: boolean;
  ordre: number;
  actif: boolean;
};

const CATS: { key: string; label: string }[] = [
  { key: "reglementaire", label: "Formations règlementaires" },
  { key: "interne", label: "Formations internes" },
];

export default function HabilitationsParamEditor({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function post(op: string, payload: Record<string, unknown>) {
    setSave("saving");
    try {
      const res = await fetch("/api/habilitations-param", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...payload }),
      });
      if (!res.ok) throw new Error();
      setSave("saved");
      return (await res.json().catch(() => ({}))) as { ok?: boolean; row?: Row };
    } catch {
      setSave("error");
      return null;
    } finally {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSave("idle"), 1500);
    }
  }
  function schedule(key: string, fn: () => void, delay: number) {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, delay);
  }
  const setRow = (id: string, fn: (r: Row) => Row) => setRows((rs) => rs.map((r) => (r.id === id ? fn(r) : r)));

  function field(id: string, key: keyof Row, value: unknown, instant = false) {
    setRow(id, (r) => ({ ...r, [key]: value }));
    schedule(`${id}:${String(key)}`, () => post("update", { id, patch: { [key]: value } }), instant ? 0 : 500);
  }

  async function addFormation(categorie: string) {
    const j = await post("create", { categorie, groupe: "" });
    if (j?.row) setRows((rs) => [...rs, j.row as Row]);
  }
  async function remove(id: string) {
    if (!window.confirm("Supprimer cette formation ? (le paramétrage, pas les habilitations déjà saisies)")) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
    await post("delete", { id });
  }

  const saveLabel = save === "saving" ? "Enregistrement…" : save === "saved" ? "Enregistré ✓" : save === "error" ? "Échec" : "";
  const saveColor = save === "error" ? "var(--danger)" : save === "saved" ? "var(--ok)" : "var(--muted)";
  const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "3px 5px" };
  const sortRows = (a: Row, b: Row) =>
    a.ordre - b.ordre || (a.groupe ?? "").localeCompare(b.groupe ?? "") || a.nom.localeCompare(b.nom);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 18, fontSize: 12, fontWeight: 600, color: saveColor, marginBottom: 6 }}>
        {saveLabel}
      </div>

      {CATS.map((cat) => {
        const catRows = rows.filter((r) => (r.categorie ?? "reglementaire") === cat.key).sort(sortRows);
        return (
          <div key={cat.key} className="card section">
            <h2 style={{ marginTop: 0 }}>{cat.label}</h2>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Groupe</th>
                  <th style={{ width: "34%" }}>Formation</th>
                  <th style={{ width: 110 }}>Validité (mois)</th>
                  <th style={{ width: 150, textAlign: "center" }} title="La formation suit une autorisation de conduite (date par personne)">Autor. conduite</th>
                  <th style={{ width: 70 }}>N° aff.</th>
                  <th style={{ width: 70, textAlign: "center" }}>Actif</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {catRows.map((r) => (
                  <tr key={r.id} style={{ opacity: r.actif ? 1 : 0.5 }}>
                    <td><input value={r.groupe ?? ""} onChange={(e) => field(r.id, "groupe", e.target.value)} placeholder="ex. Secours" style={inp} /></td>
                    <td><input value={r.nom} onChange={(e) => field(r.id, "nom", e.target.value)} placeholder="ex. SST" style={inp} /></td>
                    <td><input type="number" min={1} value={r.duree_validite_mois ?? ""} onChange={(e) => field(r.id, "duree_validite_mois", e.target.value === "" ? "" : Number(e.target.value))} placeholder="—" style={{ ...inp, width: 90 }} /></td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={r.a_autorisation_conduite} onChange={(e) => field(r.id, "a_autorisation_conduite", e.target.checked, true)} style={{ width: "auto" }} />
                    </td>
                    <td><input type="number" min={0} value={r.ordre} onChange={(e) => field(r.id, "ordre", Number(e.target.value) || 0)} style={{ ...inp, width: 56 }} /></td>
                    <td style={{ textAlign: "center" }}>
                      <ToggleSwitch on={r.actif} onChange={(v) => field(r.id, "actif", v, true)} title="Actif / inactif" />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button type="button" className="btn-sm btn-ghost" onClick={() => remove(r.id)} title="Supprimer" style={{ color: "var(--danger)" }}>🗑</button>
                    </td>
                  </tr>
                ))}
                {catRows.length === 0 && (
                  <tr><td colSpan={7} className="muted">Aucune formation dans cette catégorie.</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn-sm btn-ghost" onClick={() => addFormation(cat.key)}>＋ Ajouter une formation</button>
            </div>
          </div>
        );
      })}

      <p className="muted" style={{ fontSize: 12 }}>
        Modèle : <strong>Catégorie → Groupe → Formation</strong>. « Autor. conduite » = la formation suit une
        <strong> date d&apos;autorisation de conduite sur site</strong> par personne. La <strong>validité</strong> (mois)
        calcule automatiquement l&apos;échéance de recyclage. Enregistrement automatique.
      </p>
    </div>
  );
}
