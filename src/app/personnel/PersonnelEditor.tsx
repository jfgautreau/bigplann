"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import ToggleSwitch from "@/components/ToggleSwitch";
import TempsPartielModal from "./TempsPartielModal";
import ContratsModal from "./ContratsModal";

type HMap = Record<string, { debut: string; fin: string }>;
type TpConfig = { demi?: { mode: string; source: string; matin?: HMap; aprem?: HMap }; off?: Record<string, string[]>; horaires?: HMap };
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
  temps_partiel: boolean;
  tp_type: string | null;
  tp_config: TpConfig | null;
};
type Equipe = { id: string; nom: string; couleur?: string | null };
type Atelier = { id: string; nom: string };

const CONTRATS = ["CDI", "CDD", "INTERIM"];
const sortRows = (a: Row, b: Row) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom);
// Normalisation pour comparer des noms : sans accents/casse/ponctuation.
const normName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

const sexeBg = (x: string | null) => (x === "H" ? "#dbeafe" : x === "F" ? "#fce7f3" : undefined);
const sexeFg = (x: string | null) => (x === "H" ? "#1d4ed8" : x === "F" ? "#db2777" : undefined);
function SexePill({ sexe }: { sexe: string | null }) {
  if (sexe === "H") return <span className="sexe-pill h">H</span>;
  if (sexe === "F") return <span className="sexe-pill f">F</span>;
  return <span className="muted">—</span>;
}

type ColKey =
  | "type_contrat" | "matricule" | "numero_badge" | "nom" | "prenom" | "sexe"
  | "equipe" | "atelier" | "date_livret_accueil" | "date_fin" | "alerte" | "pointure" | "tp" | "statut";
const COLS: { key: ColKey; label: string; w: number; search?: boolean }[] = [
  { key: "type_contrat", label: "Contrat", w: 6, search: true },
  { key: "matricule", label: "Matricule", w: 7, search: true },
  { key: "numero_badge", label: "Badge", w: 6, search: true },
  { key: "nom", label: "Nom", w: 11, search: true },
  { key: "prenom", label: "Prénom", w: 10, search: true },
  { key: "sexe", label: "H/F", w: 4, search: true },
  { key: "equipe", label: "Équipe", w: 6, search: true },
  { key: "atelier", label: "Atelier", w: 6, search: true },
  { key: "date_livret_accueil", label: "Livret accueil", w: 8.5 },
  { key: "date_fin", label: "Fin contrat", w: 8.5 },
  { key: "alerte", label: "⚠ 18 mois", w: 5 },
  { key: "pointure", label: "Pointure", w: 5, search: true },
  { key: "tp", label: "TP", w: 5 },
  { key: "statut", label: "Statut", w: 6.5, search: true },
];
// Colonnes dont le contenu est centre.
const CENTER = new Set<ColKey>(["type_contrat", "matricule", "numero_badge", "sexe", "equipe", "atelier", "tp", "pointure"]);

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
  const [gq, setGq] = useState("");
  const [showColFilters, setShowColFilters] = useState(false);
  const [dup, setDup] = useState<Row[] | null>(null);
  const [contratFilter, setContratFilter] = useState("");
  const [tpFor, setTpFor] = useState<Row | null>(null);
  const [contratsFor, setContratsFor] = useState<Row | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showCreate, setShowCreate] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = todayStr();

  // Ligne d'insertion
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
  const eqStyle = (id: string | null): React.CSSProperties => {
    const c = id ? equipes.find((e) => e.id === id)?.couleur : null;
    return c ? { background: c, color: "#fff", fontWeight: 600 } : {};
  };

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

  async function doCreate() {
    setDup(null);
    const j = await post("create", {
      nom: nom.trim(), prenom: prenom.trim(), sexe, matricule, numero_badge: badge,
      equipe_id: eq, atelier_id: at, type_contrat: contrat, date_debut: today,
      date_fin: dateFin, date_livret_accueil: livret, pointure,
    });
    if (j?.row) {
      const created: Row = {
        ...(j.row as Row), atelier_id: at || null, sexe: sexe || null, numero_badge: badge || null,
        date_livret_accueil: livret || null, date_debut: today, contrat_debut: today,
      };
      setRows((rs) => [...rs, created].sort(sortRows));
      setNom(""); setPrenom(""); setSexe(""); setMatricule(""); setBadge("");
      setEq(""); setAt(""); setContrat("INTERIM"); setDateFin(""); setLivret(""); setPointure("");
    }
  }

  function add() {
    if (!nom.trim() || !prenom.trim()) return;
    const key = normName(`${nom} ${prenom}`);
    const matches = rows.filter((r) => normName(`${r.nom} ${r.prenom}`) === key);
    if (matches.length) { setDup(matches); return; } // doublon -> on demande confirmation
    doCreate();
  }

  const cellText = (r: Row, key: ColKey): string => {
    switch (key) {
      case "type_contrat": return (r.type_contrat === "INTERIM" ? "intérim interim" : r.type_contrat).toLowerCase();
      case "matricule": return (r.matricule ?? "").toLowerCase();
      case "numero_badge": return (r.numero_badge ?? "").toLowerCase();
      case "nom": return r.nom.toLowerCase();
      case "prenom": return r.prenom.toLowerCase();
      case "sexe": return (r.sexe ?? "").toLowerCase();
      case "equipe": return equipeNom(r.equipe_id).toLowerCase();
      case "atelier": return atelierNom(r.atelier_id).toLowerCase();
      case "pointure": return (r.pointure ?? "").toLowerCase();
      case "statut": return (r.statut === "ACTIF" ? "actif" : "parti");
      default: return "";
    }
  };
  const searchCols = COLS.filter((c) => c.search);
  const gTerms = gq.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = rows.filter((r) => {
    if (contratFilter && r.type_contrat !== contratFilter) return false;
    // Recherche globale : tous les mots doivent apparaitre dans une colonne cherchable.
    if (gTerms.length) {
      const hay = searchCols.map((c) => cellText(r, c.key)).join(" ");
      if (!gTerms.every((t) => hay.includes(t))) return false;
    }
    // Filtres par colonne (optionnels).
    return COLS.every((c) => {
      const needle = (q[c.key] ?? "").trim().toLowerCase();
      return !needle || cellText(r, c.key).includes(needle);
    });
  });
  const activeColFilters = Object.values(q).filter((v) => v.trim()).length;

  const saveLabel =
    save === "saving" ? "Enregistrement…" : save === "saved" ? "Enregistré ✓" : save === "error" ? "Échec d'enregistrement" : "";
  const saveColor = save === "error" ? "var(--danger)" : save === "saved" ? "var(--ok)" : "var(--muted)";
  const inp: React.CSSProperties = { width: "100%", fontSize: 13, padding: "3px 4px" };
  const C = (k: ColKey): React.CSSProperties => (CENTER.has(k) ? { textAlign: "center", textAlignLast: "center" } : {});
  const interimStyle = (t: string) => (t === "INTERIM" ? { background: "#fde68a", color: "#92400e", fontWeight: 600 } : {});

  const counts = { tous: rows.length, ...Object.fromEntries(CONTRATS.map((c) => [c, rows.filter((r) => r.type_contrat === c).length])) } as Record<string, number>;

  const Cols = () => (
    <colgroup>
      {COLS.map((c) => <col key={c.key} style={{ width: `${c.w}%` }} />)}
      {canEdit && <col style={{ width: "5.5%" }} />}
    </colgroup>
  );
  const tableStyle: React.CSSProperties = { width: "100%", tableLayout: "fixed", margin: 0, borderCollapse: "collapse" };

  return (
    <div>
      {/* Barre de filtres */}
      <div className="toolbar" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontWeight: 600 }}>Contrat :</span>
          <div className="segments">
            <button type="button" className={contratFilter === "" ? "seg active" : "seg"} onClick={() => setContratFilter("")}>Tous ({counts.tous})</button>
            {CONTRATS.map((c) => (
              <button key={c} type="button" className={contratFilter === c ? "seg active" : "seg"} onClick={() => setContratFilter(c)}>
                {c === "INTERIM" ? "Intérim" : c} ({counts[c] ?? 0})
              </button>
            ))}
          </div>
          {/* Bascule filtres par colonne */}
          <button type="button" className={showColFilters ? "seg active" : "seg"} onClick={() => setShowColFilters((v) => !v)}
            style={{ margin: 0 }} title="Afficher un filtre sous chaque colonne">
            ⛃ Filtres colonnes{activeColFilters > 0 ? ` (${activeColFilters})` : ""}
          </button>
          {activeColFilters > 0 && (
            <button type="button" className="btn-sm btn-ghost" style={{ width: "auto" }} onClick={() => setQ({})} title="Effacer tous les filtres de colonne">Réinitialiser</button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {filtered.length === rows.length ? `${rows.length} personnes` : `${filtered.length} / ${rows.length}`}
          </span>
          <span style={{ minHeight: 16, fontSize: 12, fontWeight: 600, color: saveColor }}>{saveLabel}</span>
        </div>
      </div>

      {/* Recherche globale, centrée, sous les filtres */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <span style={{ position: "relative", display: "inline-block", width: 360, maxWidth: "90vw" }}>
          <span aria-hidden style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
          <input
            value={gq}
            onChange={(e) => setGq(e.target.value)}
            placeholder="Rechercher : nom, matricule, badge, équipe…"
            style={{ width: "100%", fontSize: 13, padding: "7px 30px 7px 30px", borderRadius: 999 }}
          />
          {gq !== "" && (
            <button type="button" onClick={() => setGq("")} title="Effacer la recherche"
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, margin: 0, padding: 0, border: "none", borderRadius: "50%", background: "var(--muted)", color: "#fff", cursor: "pointer", fontSize: 11, lineHeight: "18px", textAlign: "center" }}>✕</button>
          )}
        </span>
      </div>

      {/* Tableau 1 (fixe) : entetes + recherche + creation */}
      <div className="card" style={{ padding: "6px 10px", overflowY: "auto", scrollbarGutter: "stable" }}>
        <table className="pers-table" style={tableStyle}>
          <Cols />
          <thead>
            <tr>
              {COLS.map((c) => <th key={c.key} style={{ whiteSpace: "nowrap" }}>{c.label}</th>)}
              {canEdit && (
                <th style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => setShowCreate((v) => !v)}
                    className="btn-sm"
                    style={{ width: "auto", whiteSpace: "nowrap", padding: "2px 8px" }}
                    title={showCreate ? "Masquer la ligne de création" : "Ajouter une personne"}
                    aria-expanded={showCreate}
                  >
                    {showCreate ? "✕" : "＋ Ajouter"}
                  </button>
                </th>
              )}
            </tr>
            {showColFilters && (
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} style={{ padding: "2px 4px" }}>
                    {c.search && (
                      <span style={{ position: "relative", display: "block" }}>
                        <input
                          value={q[c.key] ?? ""}
                          onChange={(e) => setQ((s) => ({ ...s, [c.key]: e.target.value }))}
                          placeholder="filtrer…"
                          aria-label={`Filtrer ${c.label}`}
                          style={{ width: "100%", fontSize: 11, padding: "3px 18px 3px 6px", fontWeight: 400, ...C(c.key) }}
                        />
                        {(q[c.key] ?? "") !== "" && (
                          <button type="button" onClick={() => setQ((s) => ({ ...s, [c.key]: "" }))} title="Effacer"
                            style={{ position: "absolute", right: 3, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, margin: 0, padding: 0, border: "none", borderRadius: "50%", background: "var(--muted)", color: "#fff", cursor: "pointer", fontSize: 9, lineHeight: "14px", textAlign: "center" }}>✕</button>
                        )}
                      </span>
                    )}
                  </th>
                ))}
                {canEdit && <th style={{ padding: "2px 4px" }}></th>}
              </tr>
            )}
          </thead>
          {canEdit && showCreate && (
            <tbody>
              <tr style={{ background: "#eff6ff" }}>
                <td><select value={contrat} onChange={(e) => setContrat(e.target.value)} style={{ ...inp, ...C("type_contrat"), ...interimStyle(contrat) }}>{CONTRATS.map((c) => (<option key={c} value={c}>{c === "INTERIM" ? "Intérim" : c}</option>))}</select></td>
                <td><input value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="auto" style={{ ...inp, ...C("matricule") }} /></td>
                <td><input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="badge" style={{ ...inp, ...C("numero_badge") }} /></td>
                <td><input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom *" style={inp} /></td>
                <td><input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom *" style={inp} /></td>
                <td><select value={sexe} onChange={(e) => setSexe(e.target.value)} style={{ ...inp, ...C("sexe"), background: sexeBg(sexe || null), color: sexeFg(sexe || null), fontWeight: 600 }}><option value="">-</option><option value="H">H</option><option value="F">F</option></select></td>
                <td><select value={eq} onChange={(e) => setEq(e.target.value)} style={{ ...inp, ...C("equipe"), ...eqStyle(eq || null) }}><option value="">-</option>{equipes.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}</select></td>
                <td><select value={at} onChange={(e) => setAt(e.target.value)} style={{ ...inp, ...C("atelier") }}><option value="">-</option>{ateliers.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}</select></td>
                <td><input type="date" value={livret} onChange={(e) => setLivret(e.target.value)} style={inp} /></td>
                <td><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={inp} /></td>
                <td></td>
                <td><input value={pointure} maxLength={5} onChange={(e) => setPointure(e.target.value)} placeholder="42" style={{ ...inp, ...C("pointure") }} /></td>
                <td className="muted" style={{ textAlign: "center", fontSize: 11 }}>après</td>
                <td></td>
                <td><button type="button" onClick={add} disabled={!nom.trim() || !prenom.trim()} className="btn-sm" style={{ width: "auto", whiteSpace: "nowrap" }} title="Créer la personne">＋ Créer</button></td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      {/* Tableau 2 (scrollable) : liste des personnes */}
      <div className="card" style={{ marginTop: 8, padding: "0 10px", maxHeight: "calc(100vh - 300px)", overflowY: "auto", scrollbarGutter: "stable" }}>
        <table className="pers-table" style={tableStyle}>
          <Cols />
          <tbody>
            {filtered.map((r) => {
              const a18 = alerte18(r);
              return (
                <tr key={r.id} style={{ opacity: r.statut === "ACTIF" ? 1 : 0.55 }}>
                  {canEdit ? (
                    <>
                      <td><select value={r.type_contrat} onChange={(e) => field(r.id, "type_contrat", e.target.value, true)} style={{ ...inp, ...C("type_contrat"), ...interimStyle(r.type_contrat) }}>{CONTRATS.map((c) => (<option key={c} value={c}>{c === "INTERIM" ? "Intérim" : c}</option>))}</select></td>
                      <td><input value={r.matricule ?? ""} onChange={(e) => field(r.id, "matricule", e.target.value)} style={{ ...inp, ...C("matricule") }} /></td>
                      <td><input value={r.numero_badge ?? ""} onChange={(e) => field(r.id, "numero_badge", e.target.value)} style={{ ...inp, ...C("numero_badge") }} /></td>
                      <td><input value={r.nom} onChange={(e) => field(r.id, "nom", e.target.value)} style={inp} /></td>
                      <td><input value={r.prenom} onChange={(e) => field(r.id, "prenom", e.target.value)} style={inp} /></td>
                      <td><select value={r.sexe ?? ""} onChange={(e) => field(r.id, "sexe", e.target.value, true)} style={{ ...inp, ...C("sexe"), background: sexeBg(r.sexe), color: sexeFg(r.sexe), fontWeight: 600 }}><option value="">-</option><option value="H">H</option><option value="F">F</option></select></td>
                      <td><select value={r.equipe_id ?? ""} onChange={(e) => field(r.id, "equipe_id", e.target.value, true)} style={{ ...inp, ...C("equipe"), ...eqStyle(r.equipe_id) }}><option value="">-</option>{equipes.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}</select></td>
                      <td><select value={r.atelier_id ?? ""} onChange={(e) => field(r.id, "atelier_id", e.target.value, true)} style={{ ...inp, ...C("atelier") }}><option value="">-</option>{ateliers.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}</select></td>
                      <td><input type="date" value={r.date_livret_accueil ?? ""} onChange={(e) => field(r.id, "date_livret_accueil", e.target.value, true)} style={inp} /></td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap", color: "var(--muted)" }} title="Fin du contrat le plus récent (gérée sur la fiche)">
                        {fmtDate(r.date_fin)}
                        <button type="button" onClick={() => setContratsFor(r)} title="Voir tous les contrats" style={{ width: "auto", margin: "0 0 0 3px", padding: "1px 3px", background: "transparent", border: "none", cursor: "pointer", fontSize: 13 }}>🔍</button>
                      </td>
                      <td style={{ textAlign: "center" }}>{a18 != null && <span className="rbadge danger" title={`Contrat de ${a18} mois (> 18)`}>⚠ {a18} m</span>}</td>
                      <td><input value={r.pointure ?? ""} maxLength={5} onChange={(e) => field(r.id, "pointure", e.target.value)} style={{ ...inp, ...C("pointure") }} /></td>
                      <td style={{ textAlign: "center" }}>
                        {r.temps_partiel ? (
                          <span className="sexe-pill" style={{ background: "#e0e7ff", color: "#3730a3", cursor: "pointer" }} onClick={() => setTpFor(r)} title="Configurer le temps partiel">TP</span>
                        ) : (
                          <button type="button" className="btn-sm btn-ghost" onClick={() => setTpFor(r)} style={{ padding: "2px 6px" }} title="Activer le temps partiel">TP…</button>
                        )}
                      </td>
                      <td><ToggleSwitch on={r.statut === "ACTIF"} onChange={(v) => toggleStatut(r.id, v)} onLabel="Actif" offLabel="Parti" title="Actif / Parti" /></td>
                      <td><Link href={`/personnel/${r.id}`} prefetch={false}>Modifier</Link></td>
                    </>
                  ) : (
                    <>
                      <td style={{ textAlign: "center" }}>{r.type_contrat === "INTERIM" ? <span className="sexe-pill" style={{ background: "#fde68a", color: "#92400e" }}>Intérim</span> : r.type_contrat}</td>
                      <td style={{ textAlign: "center" }}>{r.matricule || "-"}</td>
                      <td style={{ textAlign: "center" }}>{r.numero_badge || "-"}</td>
                      <td>{r.nom}</td>
                      <td>{r.prenom}</td>
                      <td style={{ textAlign: "center" }}><SexePill sexe={r.sexe} /></td>
                      <td style={{ textAlign: "center" }}>{equipeNom(r.equipe_id) || "-"}</td>
                      <td style={{ textAlign: "center" }}>{atelierNom(r.atelier_id) || "-"}</td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{fmtDate(r.date_livret_accueil)}</td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        {fmtDate(r.date_fin)}
                        <button type="button" onClick={() => setContratsFor(r)} title="Voir tous les contrats" style={{ width: "auto", margin: "0 0 0 3px", padding: "1px 3px", background: "transparent", border: "none", cursor: "pointer", fontSize: 13 }}>🔍</button>
                      </td>
                      <td style={{ textAlign: "center" }}>{a18 != null && <span className="rbadge danger" title={`Contrat de ${a18} mois (> 18)`}>⚠ {a18} m</span>}</td>
                      <td style={{ textAlign: "center" }}>{r.pointure || "-"}</td>
                      <td style={{ textAlign: "center" }}>{r.temps_partiel ? <span className="sexe-pill" style={{ background: "#e0e7ff", color: "#3730a3" }}>TP</span> : <span className="muted">—</span>}</td>
                      <td><span className={r.statut === "ACTIF" ? "tag" : "tag tag-off"}>{r.statut === "ACTIF" ? "Actif" : "Parti"}</span></td>
                    </>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={canEdit ? COLS.length + 1 : COLS.length} className="muted" style={{ padding: 10 }}>Aucun résultat.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {tpFor && (
        <TempsPartielModal
          personne={{ id: tpFor.id, label: `${tpFor.nom} ${tpFor.prenom}`, temps_partiel: tpFor.temps_partiel, tp_type: tpFor.tp_type, tp_config: tpFor.tp_config }}
          onClose={() => setTpFor(null)}
          onSaved={(u) => { setRow(tpFor.id, (r) => ({ ...r, ...u })); setTpFor(null); }}
        />
      )}
      {contratsFor && (
        <ContratsModal personne={{ id: contratsFor.id, label: `${contratsFor.nom} ${contratsFor.prenom}` }} onClose={() => setContratsFor(null)} />
      )}

      {dup && (
        <div onClick={() => setDup(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ margin: 0, color: "#92400e" }}>⚠ Doublon possible</h2>
              <button type="button" className="btn-sm btn-ghost" onClick={() => setDup(null)} style={{ width: "auto" }}>✕</button>
            </div>
            <p style={{ marginTop: 0 }}>
              Une personne nommée <strong>{nom.trim()} {prenom.trim()}</strong> existe déjà&nbsp;:
            </p>
            <ul style={{ margin: "4px 0 10px", paddingLeft: 18 }}>
              {dup.map((m) => (
                <li key={m.id} style={{ marginBottom: 4 }}>
                  <Link href={`/personnel/${m.id}`} prefetch={false}>{m.nom} {m.prenom}</Link>
                  {" — "}{m.type_contrat === "INTERIM" ? "Intérim" : m.type_contrat}
                  {" — "}<span className={m.statut === "ACTIF" ? "tag" : "tag tag-off"}>{m.statut === "ACTIF" ? "Actif" : "Parti"}</span>
                  {m.matricule ? <span className="muted" style={{ fontSize: 12 }}> · mat. {m.matricule}</span> : null}
                </li>
              ))}
            </ul>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#78350f" }}>
              <strong>Règle&nbsp;:</strong> on réactive l'ancien profil (bouton <em>Actif/Parti</em> sur sa ligne) plutôt que de créer
              deux fois la même personne. Cela évite les doublons et conserve l'historique, la matrice de polyvalence et le planning.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="btn-sm" onClick={() => setDup(null)} style={{ width: "auto" }}>Annuler (recommandé)</button>
              <button type="button" className="btn-sm btn-ghost" onClick={doCreate} style={{ width: "auto" }}>Créer quand même</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
