"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import ToggleSwitch from "@/components/ToggleSwitch";

type Row = {
  id: string;
  matricule: string | null;
  nom: string;
  prenom: string;
  equipe_id: string | null;
  atelier_id: string | null;
  sexe: string | null;
  type_contrat: string;
  date_fin: string | null;
  pointure: string | null;
  statut: string;
};
type Equipe = { id: string; nom: string };
type Atelier = { id: string; nom: string };

const CONTRATS = ["CDI", "CDD", "INTERIM"];
const sortRows = (a: Row, b: Row) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom);
// "2025-06-30" -> "30/06/2025" (sans decalage de fuseau)
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

// Sexe : Homme = bleu, Femme = rose.
const sexeBg = (x: string | null) => (x === "H" ? "#dbeafe" : x === "F" ? "#fce7f3" : undefined);
const sexeFg = (x: string | null) => (x === "H" ? "#1d4ed8" : x === "F" ? "#db2777" : undefined);
function SexePill({ sexe }: { sexe: string | null }) {
  if (sexe === "H") return <span className="sexe-pill h">H</span>;
  if (sexe === "F") return <span className="sexe-pill f">F</span>;
  return <span className="muted">—</span>;
}

export default function PersonnelEditor({
  initial,
  equipes,
  ateliers,
  canEdit,
}: {
  initial: Row[];
  equipes: Equipe[];
  ateliers: Atelier[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [q, setQ] = useState<Record<string, string>>({});
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Formulaire de creation
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState("");
  const [matricule, setMatricule] = useState("");
  const [eq, setEq] = useState("");
  const [at, setAt] = useState("");
  const [contrat, setContrat] = useState("CDI");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [agence, setAgence] = useState("");
  const [pointure, setPointure] = useState("");
  const [commentaire, setCommentaire] = useState("");

  const equipeNom = (id: string | null) => (id ? equipes.find((e) => e.id === id)?.nom ?? "" : "");
  const atelierNom = (id: string | null) => (id ? ateliers.find((a) => a.id === id)?.nom ?? "" : "");

  async function post(op: string, payload: Record<string, unknown>) {
    setSave("saving");
    try {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...payload }),
      });
      if (!res.ok) throw new Error();
      const j = await res.json().catch(() => ({}));
      setSave("saved");
      return j as { ok?: boolean; row?: Row };
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

  function field(id: string, key: keyof Row, value: string, instant = false) {
    setRow(id, (r) => ({ ...r, [key]: value }));
    schedule(`${id}:${key}`, () => post("update", { id, patch: { [key]: value } }), instant ? 0 : 500);
  }
  function toggleStatut(id: string, actif: boolean) {
    const statut = actif ? "ACTIF" : "PARTI";
    setRow(id, (r) => ({ ...r, statut }));
    post("toggle-statut", { id, statut });
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim()) return;
    const j = await post("create", {
      nom: nom.trim(),
      prenom: prenom.trim(),
      sexe,
      matricule,
      equipe_id: eq,
      atelier_id: at,
      type_contrat: contrat,
      agence_interim: agence,
      date_debut: dateDebut,
      date_fin: dateFin,
      pointure,
      commentaire,
    });
    if (j?.row) {
      // L'API ne renvoie pas atelier_id : on le reprend du formulaire.
      setRows((rs) => [...rs, { ...(j.row as Row), atelier_id: at || null, sexe: sexe || null }].sort(sortRows));
      setNom("");
      setPrenom("");
      setSexe("");
      setMatricule("");
      setEq("");
      setAt("");
      setContrat("CDI");
      setDateDebut("");
      setDateFin("");
      setAgence("");
      setPointure("");
      setCommentaire("");
    }
  }

  const COLS: { key: string; label: string }[] = [
    { key: "matricule", label: "Matricule" },
    { key: "nom", label: "Nom" },
    { key: "prenom", label: "Prénom" },
    { key: "sexe", label: "H/F" },
    { key: "equipe", label: "Équipe" },
    { key: "atelier", label: "Atelier" },
    { key: "type_contrat", label: "Contrat" },
    { key: "date_fin", label: "Fin contrat" },
    { key: "pointure", label: "Pointure" },
    { key: "statut", label: "Statut" },
  ];
  const cellText = (r: Row, key: string) => {
    if (key === "sexe") return r.sexe === "H" ? "h homme" : r.sexe === "F" ? "f femme" : "";
    if (key === "equipe") return equipeNom(r.equipe_id);
    if (key === "atelier") return atelierNom(r.atelier_id);
    if (key === "statut") return r.statut === "ACTIF" ? "Actif" : "Parti";
    if (key === "date_fin") return fmtDate(r.date_fin);
    return String((r as unknown as Record<string, unknown>)[key] ?? "");
  };
  const filtered = rows.filter((r) =>
    COLS.every((c) => {
      const needle = (q[c.key] ?? "").trim().toLowerCase();
      return !needle || cellText(r, c.key).toLowerCase().includes(needle);
    })
  );

  const saveLabel =
    save === "saving" ? "Enregistrement…" : save === "saved" ? "Enregistré ✓" : save === "error" ? "Échec d'enregistrement" : "";
  const saveColor = save === "error" ? "var(--danger)" : save === "saved" ? "var(--ok)" : "var(--muted)";
  const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "4px 6px" };

  return (
    <div>
      {canEdit && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Ajouter une personne</h2>
          <form onSubmit={add} autoComplete="off">
            <div className="toolbar" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: "1 1 120px" }}>
                <span>Nom *</span>
                <input value={nom} onChange={(e) => setNom(e.target.value)} required />
              </div>
              <div className="field" style={{ flex: "1 1 120px" }}>
                <span>Prénom *</span>
                <input value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
              </div>
              <div className="field" style={{ flex: "0 0 70px" }}>
                <span>Sexe</span>
                <select value={sexe} onChange={(e) => setSexe(e.target.value)} style={{ background: sexeBg(sexe || null), color: sexeFg(sexe || null), fontWeight: 600 }}>
                  <option value="">-</option>
                  <option value="H">H</option>
                  <option value="F">F</option>
                </select>
              </div>
              <div className="field" style={{ flex: "1 1 120px" }}>
                <span>Matricule</span>
                <input value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="(auto si intérim)" />
              </div>
              <div className="field" style={{ flex: "0 0 92px" }}>
                <span>Équipe</span>
                <select value={eq} onChange={(e) => setEq(e.target.value)}>
                  <option value="">-</option>
                  {equipes.map((x) => (
                    <option key={x.id} value={x.id}>{x.nom}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: "0 0 110px" }}>
                <span>Atelier</span>
                <select value={at} onChange={(e) => setAt(e.target.value)}>
                  <option value="">-</option>
                  {ateliers.map((x) => (
                    <option key={x.id} value={x.id}>{x.nom}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: "0 0 92px" }}>
                <span>Contrat</span>
                <select value={contrat} onChange={(e) => setContrat(e.target.value)}>
                  {CONTRATS.map((c) => (
                    <option key={c} value={c}>{c === "INTERIM" ? "Intérim" : c}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: "0 0 150px" }}>
                <span>Début</span>
                <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
              </div>
              <div className="field" style={{ flex: "0 0 150px" }}>
                <span>Fin (CDD/intérim)</span>
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
              </div>
              <div className="field" style={{ flex: "1 1 120px" }}>
                <span>Agence (si intérim)</span>
                <input value={agence} onChange={(e) => setAgence(e.target.value)} />
              </div>
              <div className="field" style={{ flex: "0 0 78px" }}>
                <span>Pointure</span>
                <input value={pointure} maxLength={5} onChange={(e) => setPointure(e.target.value)} placeholder="ex. 42" />
              </div>
            </div>
            <div className="field" style={{ marginTop: 4 }}>
              <span>Commentaire (pas d&apos;information médicale)</span>
              <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} style={{ width: "100%" }} />
            </div>
            <button type="submit" style={{ width: "auto", padding: "9px 22px" }}>Créer</button>
          </form>
        </div>
      )}

      <div className="card">
        <div style={{ minHeight: 16, textAlign: "right", fontSize: 12, fontWeight: 600, color: saveColor, marginBottom: 4 }}>
          {saveLabel}
        </div>
        <table className="sticky-head">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              {canEdit && <th></th>}
            </tr>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} style={{ padding: 4 }}>
                  <input
                    value={q[c.key] ?? ""}
                    onChange={(e) => setQ((s2) => ({ ...s2, [c.key]: e.target.value }))}
                    placeholder="rechercher"
                    style={{ width: "100%", fontSize: 12, padding: "4px 6px", fontWeight: 400 }}
                  />
                </th>
              ))}
              {canEdit && <th style={{ padding: 4 }}></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={{ opacity: r.statut === "ACTIF" ? 1 : 0.55 }}>
                {canEdit ? (
                  <>
                    <td><input value={r.matricule ?? ""} onChange={(e) => field(r.id, "matricule", e.target.value)} style={inp} /></td>
                    <td><input value={r.nom} onChange={(e) => field(r.id, "nom", e.target.value)} style={inp} /></td>
                    <td><input value={r.prenom} onChange={(e) => field(r.id, "prenom", e.target.value)} style={inp} /></td>
                    <td>
                      <select
                        value={r.sexe ?? ""}
                        onChange={(e) => field(r.id, "sexe", e.target.value, true)}
                        style={{ ...inp, width: 58, background: sexeBg(r.sexe), color: sexeFg(r.sexe), fontWeight: 600 }}
                      >
                        <option value="">-</option>
                        <option value="H">H</option>
                        <option value="F">F</option>
                      </select>
                    </td>
                    <td>
                      <select value={r.equipe_id ?? ""} onChange={(e) => field(r.id, "equipe_id", e.target.value, true)} style={inp}>
                        <option value="">-</option>
                        {equipes.map((x) => (
                          <option key={x.id} value={x.id}>{x.nom}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={r.atelier_id ?? ""} onChange={(e) => field(r.id, "atelier_id", e.target.value, true)} style={inp}>
                        <option value="">-</option>
                        {ateliers.map((x) => (
                          <option key={x.id} value={x.id}>{x.nom}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={r.type_contrat} onChange={(e) => field(r.id, "type_contrat", e.target.value, true)} style={inp}>
                        {CONTRATS.map((c) => (
                          <option key={c} value={c}>{c === "INTERIM" ? "Intérim" : c}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap", color: "var(--muted)" }} title="Fin du contrat le plus récent (gérée sur la fiche)">{fmtDate(r.date_fin)}</td>
                    <td><input value={r.pointure ?? ""} maxLength={5} onChange={(e) => field(r.id, "pointure", e.target.value)} style={{ ...inp, width: 64 }} /></td>
                    <td>
                      <ToggleSwitch
                        on={r.statut === "ACTIF"}
                        onChange={(v) => toggleStatut(r.id, v)}
                        onLabel="Actif"
                        offLabel="Parti"
                        title="Actif / Parti"
                      />
                    </td>
                    <td><Link href={`/personnel/${r.id}`}>Modifier</Link></td>
                  </>
                ) : (
                  <>
                    <td>{r.matricule || "-"}</td>
                    <td>{r.nom}</td>
                    <td>{r.prenom}</td>
                    <td><SexePill sexe={r.sexe} /></td>
                    <td>{equipeNom(r.equipe_id) || "-"}</td>
                    <td>{atelierNom(r.atelier_id) || "-"}</td>
                    <td>{r.type_contrat}</td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{fmtDate(r.date_fin)}</td>
                    <td>{r.pointure || "-"}</td>
                    <td>
                      <span className={r.statut === "ACTIF" ? "tag" : "tag tag-off"}>
                        {r.statut === "ACTIF" ? "Actif" : "Parti"}
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? COLS.length + 1 : COLS.length} className="muted">Aucun résultat.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
