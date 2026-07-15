"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import ToggleSwitch from "@/components/ToggleSwitch";
import ConfirmForm from "@/components/ConfirmForm";
import TempsPartielModal from "./TempsPartielModal";
import ContratsModal from "./ContratsModal";
import { anonymiserPersonne, supprimerPersonne } from "./actions";

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
  commentaire: string | null;
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
  const [gq, setGq] = useState("");
  const [dup, setDup] = useState<Row[] | null>(null);
  const [contratFilter, setContratFilter] = useState("");
  const [tpFor, setTpFor] = useState<Row | null>(null);
  const [contratsFor, setContratsFor] = useState<Row | null>(null);
  const [infoFor, setInfoFor] = useState<Row | null>(null);
  const [rgpdFor, setRgpdFor] = useState<Row | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [merge, setMerge] = useState<{ a: Row; b: Row } | null>(null);
  const [keepId, setKeepId] = useState("");
  const [merging, setMerging] = useState(false);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showCreate, setShowCreate] = useState(false);
  // Tri et filtres par colonne (facon Excel) declenches depuis les en-tetes.
  const [sortCol, setSortCol] = useState<{ key: ColKey; dir: "asc" | "desc" } | null>(null);
  const [colFilters, setColFilters] = useState<Partial<Record<ColKey, Set<string>>>>({});
  const [menu, setMenu] = useState<{ key: ColKey; left: number; top: number } | null>(null);
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
  const [livret, setLivret] = useState("");
  const [pointure, setPointure] = useState("");

  const equipeNom = (id: string | null) => (id ? equipes.find((e) => e.id === id)?.nom ?? "" : "");
  const atelierNom = (id: string | null) => (id ? ateliers.find((a) => a.id === id)?.nom ?? "" : "");
  const eqStyle = (id: string | null): React.CSSProperties => {
    const c = id ? equipes.find((e) => e.id === id)?.couleur : null;
    return c ? { background: c, color: "#1e293b", fontWeight: 600 } : {};
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

  // Fusion de doublons : selection de 2 lignes max.
  function toggleSel(id: string) {
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < 2) n.add(id); return n; });
  }
  function openMerge() {
    const ids = [...sel];
    const a = rows.find((r) => r.id === ids[0]);
    const b = rows.find((r) => r.id === ids[1]);
    if (a && b) { setMerge({ a, b }); setKeepId(a.id); }
  }
  async function doMerge() {
    if (!merge) return;
    const keep_id = keepId;
    const dup_id = keepId === merge.a.id ? merge.b.id : merge.a.id;
    setMerging(true);
    try {
      const res = await fetch("/api/personnel/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keep_id, dup_id }) });
      if (res.ok) { window.location.reload(); return; }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(j.error || "Échec de la fusion.");
    } catch { window.alert("Échec de la fusion."); }
    setMerging(false);
  }

  async function doCreate() {
    setDup(null);
    const j = await post("create", {
      nom: nom.trim(), prenom: prenom.trim(), sexe, matricule, numero_badge: badge,
      equipe_id: eq, atelier_id: at, type_contrat: contrat, date_debut: today,
      date_livret_accueil: livret, pointure,
    });
    if (j?.row) {
      const created: Row = {
        ...(j.row as Row), atelier_id: at || null, sexe: sexe || null, numero_badge: badge || null,
        date_livret_accueil: livret || null, date_debut: today, contrat_debut: today,
      };
      setRows((rs) => [...rs, created].sort(sortRows));
      setNom(""); setPrenom(""); setSexe(""); setMatricule(""); setBadge("");
      setEq(""); setAt(""); setContrat("INTERIM"); setLivret(""); setPointure("");
      setShowCreate(false);
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
  // Colonnes categorielles : filtre par liste de valeurs cochables.
  const FILTERABLE = new Set<ColKey>(["type_contrat", "sexe", "equipe", "atelier", "tp", "statut"]);
  // Valeur AFFICHEE d'une cellule (sert aux valeurs de filtre).
  const cellLabel = (r: Row, key: ColKey): string => {
    switch (key) {
      case "type_contrat": return r.type_contrat === "INTERIM" ? "Intérim" : r.type_contrat;
      case "matricule": return r.matricule || "—";
      case "numero_badge": return r.numero_badge || "—";
      case "nom": return r.nom;
      case "prenom": return r.prenom;
      case "sexe": return r.sexe === "H" ? "H" : r.sexe === "F" ? "F" : "—";
      case "equipe": return equipeNom(r.equipe_id) || "—";
      case "atelier": return atelierNom(r.atelier_id) || "—";
      case "date_livret_accueil": return fmtDate(r.date_livret_accueil);
      case "date_fin": return fmtDate(r.date_fin);
      case "alerte": { const a = alerte18(r); return a != null ? `⚠ ${a} m` : "—"; }
      case "pointure": return r.pointure || "—";
      case "tp": return r.temps_partiel ? "TP" : "—";
      case "statut": return r.statut === "ACTIF" ? "Actif" : "Parti";
      default: return "";
    }
  };
  // Cle de tri (iso pour les dates, nombre pour pointure/alerte -> tri naturel).
  const cellSortKey = (r: Row, key: ColKey): string | number => {
    switch (key) {
      case "date_livret_accueil": return r.date_livret_accueil ?? "";
      case "date_fin": return r.date_fin ?? "";
      case "alerte": return alerte18(r) ?? -1;
      case "pointure": return r.pointure ?? "";
      case "tp": return r.temps_partiel ? 1 : 0;
      case "equipe": return equipeNom(r.equipe_id);
      case "atelier": return atelierNom(r.atelier_id);
      default: return cellLabel(r, key);
    }
  };
  const distinctFor = (key: ColKey) =>
    [...new Set(rows.map((r) => cellLabel(r, key)))].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  const isFilterActive = (key: ColKey) => {
    const set = colFilters[key];
    return !!set && set.size < distinctFor(key).length;
  };

  function toggleFilterVal(key: ColKey, val: string) {
    setColFilters((f) => {
      const cur = f[key] ?? new Set(distinctFor(key)); // absent = tout coche
      const next = new Set(cur);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return { ...f, [key]: next };
    });
  }
  const setAllFilter = (key: ColKey, all: boolean) =>
    setColFilters((f) => ({ ...f, [key]: all ? new Set(distinctFor(key)) : new Set<string>() }));
  const clearFilter = (key: ColKey) =>
    setColFilters((f) => { const n = { ...f }; delete n[key]; return n; });

  const searchCols = COLS.filter((c) => c.search);
  const gTerms = gq.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = rows.filter((r) => {
    if (contratFilter && r.type_contrat !== contratFilter) return false;
    // Filtres par colonne (valeurs cochees).
    for (const key of Object.keys(colFilters) as ColKey[]) {
      const set = colFilters[key];
      if (set && !set.has(cellLabel(r, key))) return false;
    }
    // Recherche globale : tous les mots doivent apparaitre dans une colonne cherchable.
    if (gTerms.length) {
      const hay = searchCols.map((c) => cellText(r, c.key)).join(" ");
      if (!gTerms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  // Tri applique apres filtrage (les colonnes non triees gardent l'ordre nom+prenom).
  const displayed = sortCol
    ? [...filtered].sort((a, b) => {
        const va = cellSortKey(a, sortCol.key);
        const vb = cellSortKey(b, sortCol.key);
        const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fr", { numeric: true });
        return sortCol.dir === "asc" ? c : -c;
      })
    : filtered;

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
    <>
      {/* Barre de filtres : contrat aligné à droite (colonne centrée 1500 px) */}
      <div className="headband">
      <div className="toolbar" style={{ alignItems: "center", justifyContent: "flex-end", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
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
        </div>
      </div>
      </div>

      {/* La grille occupe toute la largeur de la fenêtre. */}
      <div className="gridband">
      {/* Recherche centrée (fixe) + nombre de personnes ancré à droite (n'affecte pas le centrage) */}
      <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 8, minHeight: 34, flex: "0 0 auto" }}>
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
        <span style={{ position: "absolute", right: 0, display: "flex", alignItems: "center", gap: 12 }}>
          {canEdit && sel.size === 2 && (
            <button type="button" className="btn-sm" style={{ width: "auto", whiteSpace: "nowrap" }} onClick={openMerge} title="Fusionner les 2 personnes sélectionnées">🔗 Fusionner</button>
          )}
          <span className="muted" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
            {filtered.length === rows.length ? `${rows.length} personnes` : `${filtered.length} / ${rows.length}`}
          </span>
          <span style={{ minHeight: 16, fontSize: 12, fontWeight: 600, color: saveColor }}>{saveLabel}</span>
        </span>
      </div>

      {/* Tableau 1 (fixe) : entetes + recherche + creation */}
      <div className="card" style={{ padding: "6px 10px", overflowY: "auto", scrollbarGutter: "stable" }}>
        <table className="pers-table" style={tableStyle}>
          <Cols />
          <thead>
            <tr>
              {COLS.map((c) => {
                const sorted = sortCol?.key === c.key;
                const flt = isFilterActive(c.key);
                return (
                  <th key={c.key} style={{ whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {c.label}
                      <button
                        type="button"
                        title="Trier / filtrer"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenu((m) => (m?.key === c.key ? null : { key: c.key, left: rect.left, top: rect.bottom }));
                        }}
                        style={{
                          width: "auto", margin: 0, padding: "0 3px", lineHeight: 1.4, fontSize: 11,
                          border: "1px solid " + (sorted || flt ? "#1d4ed8" : "var(--border)"),
                          borderRadius: 4, cursor: "pointer",
                          background: sorted || flt ? "#1d4ed8" : "#fff",
                          color: sorted || flt ? "#fff" : "var(--muted)",
                        }}
                      >
                        {sorted ? (sortCol!.dir === "asc" ? "▲" : "▼") : flt ? "▦" : "▾"}
                      </button>
                    </span>
                  </th>
                );
              })}
              {canEdit && (
                <th style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="btn-sm"
                    style={{ width: "auto", whiteSpace: "nowrap", padding: "2px 8px" }}
                    title="Ajouter une personne"
                  >
                    ＋ Ajouter
                  </button>
                </th>
              )}
            </tr>
          </thead>
        </table>
      </div>

      {/* Tableau 2 (scrollable) : liste des personnes */}
      <div className="card grow" style={{ marginTop: 8, padding: "0 10px", overflowY: "auto", scrollbarGutter: "stable" }}>
        <table className="pers-table" style={tableStyle}>
          <Cols />
          <tbody>
            {displayed.map((r) => {
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
                      <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>
                        <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} disabled={!sel.has(r.id) && sel.size >= 2} title="Sélectionner pour fusionner (2 max)" style={{ width: "auto", marginRight: 3, verticalAlign: "middle" }} />
                        <button type="button" className="btn-sm btn-ghost" title="Informations (commentaire)" onClick={() => setInfoFor(r)} style={{ width: "auto", padding: "2px 5px", fontSize: 15 }}>ⓘ</button>
                        <button type="button" className="btn-sm btn-ghost" title="RGPD (export / anonymiser / supprimer)" onClick={() => setRgpdFor(r)} style={{ width: "auto", padding: "2px 5px", fontSize: 14 }}>⚙️</button>
                      </td>
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
            {displayed.length === 0 && (
              <tr><td colSpan={canEdit ? COLS.length + 1 : COLS.length} className="muted" style={{ padding: 10 }}>Aucun résultat.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Menu Trier / filtrer d'une colonne (position fixe -> pas de clipping). */}
      {menu && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div
            style={{
              position: "fixed",
              left: Math.min(menu.left, (typeof window !== "undefined" ? window.innerWidth : 9999) - 250),
              top: menu.top + 4,
              zIndex: 91,
              width: 232,
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
              padding: 8,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
              {COLS.find((c) => c.key === menu.key)?.label}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button type="button" className="btn-sm btn-ghost" style={{ width: "auto", flex: 1 }} onClick={() => { setSortCol({ key: menu.key, dir: "asc" }); setMenu(null); }}>▲ A→Z</button>
              <button type="button" className="btn-sm btn-ghost" style={{ width: "auto", flex: 1 }} onClick={() => { setSortCol({ key: menu.key, dir: "desc" }); setMenu(null); }}>▼ Z→A</button>
            </div>
            {sortCol?.key === menu.key && (
              <button type="button" className="btn-sm btn-ghost" style={{ width: "100%", marginBottom: 6 }} onClick={() => { setSortCol(null); setMenu(null); }}>Annuler le tri</button>
            )}
            {FILTERABLE.has(menu.key) && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Filtrer</span>
                  <span>
                    <button type="button" className="btn-sm btn-ghost" style={{ width: "auto", padding: "1px 6px" }} onClick={() => setAllFilter(menu.key, true)}>Tout</button>
                    <button type="button" className="btn-sm btn-ghost" style={{ width: "auto", padding: "1px 6px" }} onClick={() => setAllFilter(menu.key, false)}>Aucun</button>
                  </span>
                </div>
                <div style={{ maxHeight: 190, overflowY: "auto" }}>
                  {distinctFor(menu.key).map((val) => {
                    const set = colFilters[menu.key];
                    const checked = set ? set.has(val) : true;
                    return (
                      <label key={val} style={{ display: "flex", gap: 6, alignItems: "center", padding: "2px 0", fontSize: 13, cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleFilterVal(menu.key, val)} style={{ width: "auto" }} />
                        {val}
                      </label>
                    );
                  })}
                </div>
                {isFilterActive(menu.key) && (
                  <button type="button" className="btn-sm btn-ghost" style={{ width: "100%", marginTop: 6 }} onClick={() => clearFilter(menu.key)}>Effacer le filtre</button>
                )}
              </div>
            )}
          </div>
        </>
      )}

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

      {/* Modale Informations : commentaire (enregistrement auto, reflété sur la ligne). */}
      {infoFor && (
        <div onClick={() => setInfoFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>Informations — {infoFor.nom} {infoFor.prenom}</h2>
              <button type="button" className="btn-sm btn-ghost" onClick={() => setInfoFor(null)} style={{ width: "auto" }}>✕</button>
            </div>
            <label htmlFor="pers-commentaire" style={{ fontWeight: 600 }}>Commentaire</label>
            <textarea
              id="pers-commentaire"
              value={rows.find((r) => r.id === infoFor.id)?.commentaire ?? ""}
              onChange={(e) => field(infoFor.id, "commentaire", e.target.value)}
              rows={4}
              style={{ width: "100%", fontSize: 13, padding: "6px 8px", marginTop: 4 }}
            />
            <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Ne pas saisir d&apos;information médicale. Enregistrement automatique.
            </p>
          </div>
        </div>
      )}

      {/* Modale RGPD : export / anonymiser / supprimer (admin). */}
      {rgpdFor && (
        <div onClick={() => setRgpdFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto", borderColor: "#fca5a5" }}>
            <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>RGPD — {rgpdFor.nom} {rgpdFor.prenom}</h2>
              <button type="button" className="btn-sm btn-ghost" onClick={() => setRgpdFor(null)} style={{ width: "auto" }}>✕</button>
            </div>
            <div className="toolbar" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <a href={`/api/personnel/${rgpdFor.id}/export`} className="btn-sm btn-ghost" style={{ textDecoration: "none" }}>
                Exporter les données (JSON)
              </a>
              <ConfirmForm
                action={anonymiserPersonne}
                hidden={{ id: rgpdFor.id }}
                label="Anonymiser"
                confirm="Anonymiser cette personne ? Le nom est remplacé, l'historique de placement est conservé."
              />
              <ConfirmForm
                action={supprimerPersonne}
                hidden={{ id: rgpdFor.id }}
                label="Supprimer (droit à l'oubli)"
                className="btn-sm"
                confirm="Supprimer DÉFINITIVEMENT cette personne et tout son historique ? Action irréversible."
              />
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Anonymiser conserve l&apos;historique (bilans) en retirant l&apos;identité. Supprimer efface définitivement la personne et ses données liées.
            </p>
          </div>
        </div>
      )}

      {/* Modale de fusion de deux personnes. */}
      {merge && (
        <div onClick={() => !merging && setMerge(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>Fusionner deux personnes</h2>
              <button type="button" className="btn-sm btn-ghost" disabled={merging} onClick={() => setMerge(null)} style={{ width: "auto" }}>✕</button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Choisis la fiche à <strong>conserver</strong>. L&apos;autre sera supprimée après transfert de tous
              ses rattachements (planning, matrice, habilitations, contrats, absences, horaires).
            </p>
            {[merge.a, merge.b].map((r) => (
              <label key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, cursor: "pointer", background: keepId === r.id ? "#eff6ff" : undefined }}>
                <input type="radio" name="keep" checked={keepId === r.id} onChange={() => setKeepId(r.id)} style={{ width: "auto" }} />
                <span>
                  <strong>{r.nom} {r.prenom}</strong> — {r.type_contrat === "INTERIM" ? "Intérim" : r.type_contrat} · {r.statut === "ACTIF" ? "Actif" : "Parti"}
                  {r.matricule ? <span className="muted"> · mat. {r.matricule}</span> : null}
                  {r.numero_badge ? <span className="muted"> · badge {r.numero_badge}</span> : null}
                </span>
              </label>
            ))}
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#78350f" }}>
              Fusion <strong>irréversible</strong>. En cas de doublon d&apos;affectation (même jour/poste/formation), la valeur
              de la fiche conservée est gardée ; ses champs vides sont complétés par l&apos;autre.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="btn-sm btn-ghost" disabled={merging} onClick={() => setMerge(null)} style={{ width: "auto" }}>Annuler</button>
              <button type="button" className="btn-sm" disabled={merging} onClick={doMerge} style={{ width: "auto" }}>{merging ? "Fusion…" : "Fusionner"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de création d'une nouvelle personne (centrée). */}
      {canEdit && showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Nouvelle personne</h2>
              <button type="button" className="btn-sm btn-ghost" onClick={() => setShowCreate(false)} style={{ width: "auto" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              <div className="field">
                <span>Contrat</span>
                <select value={contrat} onChange={(e) => setContrat(e.target.value)} style={interimStyle(contrat)}>
                  {CONTRATS.map((c) => (<option key={c} value={c}>{c === "INTERIM" ? "Intérim" : c}</option>))}
                </select>
              </div>
              <div className="field">
                <span>Matricule</span>
                <input value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="auto (intérim)" />
              </div>
              <div className="field">
                <span>Badge</span>
                <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="badge" />
              </div>
              <div className="field">
                <span>Nom *</span>
                <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" />
              </div>
              <div className="field">
                <span>Prénom *</span>
                <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" />
              </div>
              <div className="field">
                <span>H/F</span>
                <select value={sexe} onChange={(e) => setSexe(e.target.value)} style={{ background: sexeBg(sexe || null), color: sexeFg(sexe || null), fontWeight: 600 }}>
                  <option value="">-</option><option value="H">H</option><option value="F">F</option>
                </select>
              </div>
              <div className="field">
                <span>Équipe</span>
                <select value={eq} onChange={(e) => setEq(e.target.value)} style={eqStyle(eq || null)}>
                  <option value="">-</option>{equipes.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}
                </select>
              </div>
              <div className="field">
                <span>Atelier</span>
                <select value={at} onChange={(e) => setAt(e.target.value)}>
                  <option value="">-</option>{ateliers.map((x) => (<option key={x.id} value={x.id}>{x.nom}</option>))}
                </select>
              </div>
              <div className="field">
                <span>Livret accueil</span>
                <input type="date" value={livret} onChange={(e) => setLivret(e.target.value)} />
              </div>
              <div className="field">
                <span>Pointure</span>
                <input value={pointure} maxLength={5} onChange={(e) => setPointure(e.target.value)} placeholder="42" />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" className="btn-sm btn-ghost" onClick={() => setShowCreate(false)} style={{ width: "auto" }}>Annuler</button>
              <button type="button" onClick={add} disabled={!nom.trim() || !prenom.trim()} className="btn-sm" style={{ width: "auto" }} title="Créer la personne">＋ Créer</button>
            </div>
          </div>
        </div>
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
    </>
  );
}
