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
  numero_badge: string | null;
  date_livret_accueil: string | null;
  type_contrat: string;
  date_debut: string | null;
  date_fin: string | null;
  contrat_debut: string | null;
  pointure: string | null;
  statut: string;
};
type Equipe = { id: string; nom: string };
type Atelier = { id: string; nom: string };

const CONTRATS = ["CDI", "CDD", "INTERIM"];
const sortRows = (a: Row, b: Row) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom);
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthsBetween = (a: string, b: string) => {
  const d1 = new Date(a + "T00:00"), d2 = new Date(b + "T00:00");
  let m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) m--;
  return m;
};

// Sexe : Homme = bleu, Femme = rose.
const sexeBg = (x: string | null) => (x === "H" ? "#dbeafe" : x === "F" ? "#fce7f3" : undefined);
const sexeFg = (x: string | null) => (x === "H" ? "#1d4ed8" : x === "F" ? "#db2777" : undefined);
function SexePill({ sexe }: { sexe: string | null }) {
  if (sexe === "H") return <span className="sexe-pill h">H</span>;
  if (sexe === "F") return <span className="sexe-pill f">F</span>;
  return <span className="muted">—</span>;
}

type ColKey =
  | "type_contrat" | "matricule" | "numero_badge" | "nom" | "prenom" | "sexe"
  | "equipe" | "atelier" | "date_livret_accueil" | "date_fin" | "alerte" | "pointure" | "statut";
const COLS: { key: ColKey; label: string; search?: boolean }[] = [
  { key: "type_contrat", label: "Contrat" },
  { key: "matricule", label: "Matricule", search: true },
  { key: "numero_badge", label: "Badge", search: true },
  { key: "nom", label: "Nom", search: true },
  { key: "prenom", label: "Prénom", search: true },
  { key: "sexe", label: "H/F" },
  { key: "equipe", label: "Équipe", search: true },
  { key: "atelier", label: "Atelier", search: true },
  { key: "date_livret_accueil", label: "Livret accueil" },
  { key: "date_fin", label: "Fin contrat" },
  { key: "alerte", label: "⚠ 18 mois" },
  { key: "pointure", label: "Pointure" },
  { key: "statut", label: "Statut" },
];

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
  const [contratFilter, setContratFilter] = useState("");
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = todayStr();

  // Ligne d'insertion (en haut du tableau)
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState("");
  const [matricule, setMatricule] = useState("");
  const [badge, setBadge] = useState("");
  const [eq, setEq] = useState("");
  const [at, setAt] = useState("");
  const [contrat, setContrat] = useState("INTERIM");
  const [dateFin, setDateFin] = useState("");
  const [livret, setLivret] = useState("");
  const [pointure, setPointure] = useState("");

  const equipeNom = (id: string | null) => (id ? equipes.find((e) => e.id === id)?.nom ?? "" : "");
  const atelierNom = (id: string | null) => (id ? ateliers.find((a) => a.id === id)?.nom ?? "" : "");

  // Alerte > 18 mois (hors CDI). Reference = fin de contrat si connue, sinon aujourd'hui.
  const alerte18 = (r: Row): number | null => {
    if (r.type_contrat === "CDI" || !r.contrat_debut) return null;
    const m = monthsBetween(r.contrat_debut, r.date_fin ?? today);
    return m >= 18 ? m : null;
  };

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

  async function add() {
    if (!nom.trim() || !prenom.trim()) return;
    const j = await post("create", {
      nom: nom.trim(),
      prenom: prenom.trim(),
      sexe,
      matricule,
      numero_badge: badge,
      equipe_id: eq,
      atelier_id: at,
      type_contrat: contrat,
      date_debut: today,
      date_fin: dateFin,
      date_livret_accueil: livret,
      pointure,
    });
    if (j?.row) {
      const created: Row = {
        ...(j.row as Row),
        atelier_id: at || null,
        sexe: sexe || null,
        numero_badge: badge || null,
        date_livret_accueil: livret || null,
        date_debut: today,
        contrat_debut: today,
      };
      setRows((rs) => [...rs, created].sort(sortRows));
      setNom(""); setPrenom(""); setSexe(""); setMatricule(""); setBadge("");
      setEq(""); setAt(""); setContrat("INTERIM"); setDateFin(""); setLivret(""); setPointure("");
    }
  }

  const cellText = (r: Row, key: ColKey) => {
    switch (key) {
      case "equipe": return equipeNom(r.equipe_id);
      case "atelier": return atelierNom(r.atelier_id);
      case "matricule": return r.matricule ?? "";
      case "numero_badge": return r.numero_badge ?? "";
      case "nom": return r.nom;
      case "prenom": return r.prenom;
      case "type_contrat": return r.type_contrat;
      default: return "";
    }
  };
  const filtered = rows.filter((r) => {
    if (contratFilter && r.type_contrat !== contratFilter) return false;
    return COLS.every((c) => {
      const needle = (q[c.key] ?? "").trim().toLowerCase();
      return !needle || cellText(r, c.key).toLowerCase().includes(needle);
    });
  });

  const saveLabel =
    save === "saving" ? "Enregistrement…" : save === "saved" ? "Enregistré ✓" : save === "error" ? "Échec d'enregistrement" : "";
  const saveColor = save === "error" ? "var(--danger)" : save === "saved" ? "var(--ok)" : "var(--muted)";
  const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "4px 6px" };
  const interimStyle = (t: string) => (t === "INTERIM" ? { background: "#fde68a", color: "#92400e", fontWeight: 600 } : {});

  const counts = { tous: rows.length, ...Object.fromEntries(CONTRATS.map((c) => [c, rows.filter((r) => r.type_contrat === c).length])) } as Record<string, number>;

  return (
    <div>
      {/* Barre de filtres */}
      <div className="toolbar" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="muted" style={{ fontWeight: 600 }}>Contrat :</span>
          <div className="segments">
            <button type="button" className={contratFilter === "" ? "seg active" : "seg"} onClick={() => setContratFilter("")}>
              Tous ({counts.tous})
            </button>
            {CONTRATS.map((c) => (
              <button key={c} type="button" className={contratFilter === c ? "seg active" : "seg"} onClick={() => setContratFilter(c)}>
                {c === "INTERIM" ? "Intérim" : c} ({counts[c] ?? 0})
              </button>
            ))}
          </div>
        </div>
        <span style={{ minHeight: 16, fontSize: 12, fontWeight: 600, color: saveColor }}>{saveLabel}</span>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="sticky-head">
          <thead>
            <tr>
              {COLS.map((c) => (<th key={c.key} style={{ whiteSpace: "nowrap" }}>{c.label}</th>))}
              {canEdit && <th></th>}
            </tr>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} style={{ padding: 4 }}>
                  {c.search && (
                    <input
                      value={q[c.key] ?? ""}
                      onChange={(e) => setQ((s2) => ({ ...s2, [c.key]: e.target.value }))}
                      placeholder="rechercher"
                      style={{ width: "100%", fontSize: 12, padding: "4px 6px", fontWeight: 400 }}
                    />
                  )}
                </th>
              ))}
              {canEdit && <th style={{ padding: 4 }}></th>}
            </tr>
          </thead>
          <tbody>
            {/* Ligne d'insertion d'une nouvelle personne */}
            {canEdit && (
              <tr style={{ background: "#f0f9ff" }}>
                <td>
                  <select value={contrat} onChange={(e) => setContrat(e.target.value)} style={{ ...inp, ...interimStyle(contrat) }}>
                    {CONTRATS.map((c) => (<option key={c} value={c}>{c === "INTERIM" ? "Intérim" : c}</option>))}
                  </select>
                </td>
                <td><input value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="(auto intérim)" style={inp} /></td>
                <td><input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="badge" style={inp} /></td>
                <td><input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom *" style={inp} /></td>
                <td><input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom *" style={inp} /></td>
                <td>
                  <select value={sexe} onChange={(e) => setSexe(e.target.value)} style={{ ...inp, width: 58, background: sexeBg(sexe || null), color: sexeFg(sexe || null), fontWeight: 600 }}>
                    <option value="">-</option><option value="H">H</option><option value="F">F</option>
                  </select>
                </td>
                <td>
                  <select value={eq} onChange={(e) => setEq(e.target.value)} style={inp}>
                    <option value="">-</option>
                    {equipes.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}
                  </select>
                </td>
                <td>
                  <select value={at} onChange={(e) => setAt(e.target.value)} style={inp}>
                    <option value="">-</option>
                    {ateliers.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}
                  </select>
                </td>
                <td><input type="date" value={livret} onChange={(e) => setLivret(e.target.value)} style={inp} /></td>
                <td><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={inp} /></td>
                <td></td>
                <td><input value={pointure} maxLength={5} onChange={(e) => setPointure(e.target.value)} placeholder="42" style={{ ...inp, width: 56 }} /></td>
                <td></td>
                <td>
                  <button type="button" onClick={add} disabled={!nom.trim() || !prenom.trim()} className="btn-sm" style={{ width: "auto", whiteSpace: "nowrap" }} title="Créer la personne">
                    ＋ Créer
                  </button>
                </td>
              </tr>
            )}

            {filtered.map((r) => {
              const a18 = alerte18(r);
              return (
                <tr key={r.id} style={{ opacity: r.statut === "ACTIF" ? 1 : 0.55 }}>
                  {canEdit ? (
                    <>
                      <td>
                        <select value={r.type_contrat} onChange={(e) => field(r.id, "type_contrat", e.target.value, true)} style={{ ...inp, ...interimStyle(r.type_contrat) }}>
                          {CONTRATS.map((c) => (<option key={c} value={c}>{c === "INTERIM" ? "Intérim" : c}</option>))}
                        </select>
                      </td>
                      <td><input value={r.matricule ?? ""} onChange={(e) => field(r.id, "matricule", e.target.value)} style={inp} /></td>
                      <td><input value={r.numero_badge ?? ""} onChange={(e) => field(r.id, "numero_badge", e.target.value)} style={inp} /></td>
                      <td><input value={r.nom} onChange={(e) => field(r.id, "nom", e.target.value)} style={inp} /></td>
                      <td><input value={r.prenom} onChange={(e) => field(r.id, "prenom", e.target.value)} style={inp} /></td>
                      <td>
                        <select value={r.sexe ?? ""} onChange={(e) => field(r.id, "sexe", e.target.value, true)} style={{ ...inp, width: 58, background: sexeBg(r.sexe), color: sexeFg(r.sexe), fontWeight: 600 }}>
                          <option value="">-</option><option value="H">H</option><option value="F">F</option>
                        </select>
                      </td>
                      <td>
                        <select value={r.equipe_id ?? ""} onChange={(e) => field(r.id, "equipe_id", e.target.value, true)} style={inp}>
                          <option value="">-</option>
                          {equipes.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}
                        </select>
                      </td>
                      <td>
                        <select value={r.atelier_id ?? ""} onChange={(e) => field(r.id, "atelier_id", e.target.value, true)} style={inp}>
                          <option value="">-</option>
                          {ateliers.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}
                        </select>
                      </td>
                      <td><input type="date" value={r.date_livret_accueil ?? ""} onChange={(e) => field(r.id, "date_livret_accueil", e.target.value, true)} style={inp} /></td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap", color: "var(--muted)" }} title="Fin du contrat le plus récent (gérée sur la fiche)">{fmtDate(r.date_fin)}</td>
                      <td style={{ textAlign: "center" }}>{a18 != null && <span className="rbadge danger" title={`Contrat de ${a18} mois (> 18)`}>⚠ {a18} m</span>}</td>
                      <td><input value={r.pointure ?? ""} maxLength={5} onChange={(e) => field(r.id, "pointure", e.target.value)} style={{ ...inp, width: 56 }} /></td>
                      <td><ToggleSwitch on={r.statut === "ACTIF"} onChange={(v) => toggleStatut(r.id, v)} onLabel="Actif" offLabel="Parti" title="Actif / Parti" /></td>
                      <td><Link href={`/personnel/${r.id}`}>Modifier</Link></td>
                    </>
                  ) : (
                    <>
                      <td>{r.type_contrat === "INTERIM" ? <span className="sexe-pill" style={{ background: "#fde68a", color: "#92400e" }}>Intérim</span> : r.type_contrat}</td>
                      <td>{r.matricule || "-"}</td>
                      <td>{r.numero_badge || "-"}</td>
                      <td>{r.nom}</td>
                      <td>{r.prenom}</td>
                      <td><SexePill sexe={r.sexe} /></td>
                      <td>{equipeNom(r.equipe_id) || "-"}</td>
                      <td>{atelierNom(r.atelier_id) || "-"}</td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{fmtDate(r.date_livret_accueil)}</td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{fmtDate(r.date_fin)}</td>
                      <td style={{ textAlign: "center" }}>{a18 != null && <span className="rbadge danger" title={`Contrat de ${a18} mois (> 18)`}>⚠ {a18} m</span>}</td>
                      <td>{r.pointure || "-"}</td>
                      <td><span className={r.statut === "ACTIF" ? "tag" : "tag tag-off"}>{r.statut === "ACTIF" ? "Actif" : "Parti"}</span></td>
                    </>
                  )}
                </tr>
              );
            })}
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
