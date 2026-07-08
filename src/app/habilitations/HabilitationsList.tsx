"use client";

import { useState } from "react";
import { joursRestants, habStatut, addMonthsIso, HAB_COLOR } from "@/lib/habilitations";

type Row = {
  id: string;
  personne_id: string;
  competence_id: string;
  date_obtention: string | null;
  date_expiration: string | null;
  date_autorisation_conduite: string | null;
  personne: { nom: string; prenom: string } | null;
  competence: { nom: string; a_recycler: boolean; a_autorisation_conduite: boolean } | null;
};
type Personne = { id: string; nom: string; prenom: string };
type Comp = { id: string; nom: string; duree_validite_mois: number | null; categorie: string | null; groupe: string | null; ordre: number; a_autorisation_conduite: boolean };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtDate = (iso: string | null) => (iso ? iso.split("-").reverse().join("-") : "—"); // JJ-MM-AAAA
const CAT_LABEL: Record<string, string> = { reglementaire: "Formations règlementaires", interne: "Formations internes" };
const CAT_ORDER = ["reglementaire", "interne"];
const catOf = (c: string | null) => (c === "interne" ? "interne" : "reglementaire");

// Echeance effective : date stockee, sinon recalculee (obtention + duree de validite).
const effExp = (rec: Row, comp?: Comp) => rec.date_expiration ?? addMonthsIso(rec.date_obtention, comp?.duree_validite_mois);

export default function HabilitationsList({
  rows,
  personnes,
  comps,
  children,
}: {
  rows: Row[];
  personnes: Personne[];
  comps: Comp[];
  children?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grille" | "liste">("grille"); // grille par défaut
  const [showMaj, setShowMaj] = useState(false);

  const compById = new Map(comps.map((c) => [c.id, c]));
  const q = search.trim();
  // Recherche multi-critères : nom de personne, mais aussi formation / groupe / catégorie.
  const personMatch = (p: { nom: string; prenom: string }) => norm(`${p.nom} ${p.prenom}`).includes(norm(q));
  const compMatch = (c: Comp) => norm(`${c.nom} ${c.groupe ?? ""} ${CAT_LABEL[catOf(c.categorie)]}`).includes(norm(q));

  // Enregistrement par (personne, formation).
  const recMap = new Map<string, Row>();
  for (const r of rows) recMap.set(`${r.personne_id}:${r.competence_id}`, r);

  // Colonnes ordonnées.
  const ordered = [...comps].sort(
    (a, b) => CAT_ORDER.indexOf(catOf(a.categorie)) - CAT_ORDER.indexOf(catOf(b.categorie)) || a.ordre - b.ordre || a.nom.localeCompare(b.nom)
  );

  // Filtrage : si la recherche touche des personnes on filtre les lignes ; si elle
  // touche des formations on filtre les colonnes ; sinon on garde tout (ou rien si
  // la recherche ne correspond à rien).
  const hasPersonHit = q ? personnes.some(personMatch) : false;
  const hasCompHit = q ? ordered.some(compMatch) : false;
  const noHit = !!q && !hasPersonHit && !hasCompHit;
  const shownPersonnes = !q ? personnes : noHit ? [] : hasPersonHit ? personnes.filter(personMatch) : personnes;
  const shownOrdered = !q ? ordered : noHit ? [] : hasCompHit ? ordered.filter(compMatch) : ordered;
  const shownRows = !q
    ? rows
    : rows.filter((r) => {
        const p = r.personne ? personMatch(r.personne) : false;
        const c = compById.get(r.competence_id);
        return p || (c ? compMatch(c) : r.competence ? norm(r.competence.nom).includes(norm(q)) : false);
      });

  const catSpans: { key: string; label: string; span: number }[] = [];
  const grpSpans: { key: string; label: string; span: number }[] = [];
  for (const c of shownOrdered) {
    const ck = catOf(c.categorie);
    if (!catSpans.length || catSpans[catSpans.length - 1].key !== ck) catSpans.push({ key: ck, label: CAT_LABEL[ck], span: 1 });
    else catSpans[catSpans.length - 1].span++;
    const gk = `${ck}|${c.groupe ?? "—"}`;
    if (!grpSpans.length || grpSpans[grpSpans.length - 1].key !== gk) grpSpans.push({ key: gk, label: c.groupe ?? "—", span: 1 });
    else grpSpans[grpSpans.length - 1].span++;
  }

  const Dot = ({ color, title }: { color: string; title: string }) => (
    <span title={title} style={{ display: "inline-block", width: 13, height: 13, borderRadius: "50%", background: color, border: "1px solid rgba(0,0,0,0.15)" }} />
  );
  function cellDot(personId: string, c: Comp) {
    const rec = recMap.get(`${personId}:${c.id}`);
    if (!rec) return <span style={{ color: "#e2e8f0" }} title="Non habilité">·</span>;
    const auTxt = rec.date_autorisation_conduite ? ` · autorisation ${fmtDate(rec.date_autorisation_conduite)}` : "";
    const exp = effExp(rec, c);
    if (!exp) return <Dot color={HAB_COLOR.vert} title={`${c.nom} — valable (pas de date de validité)${auTxt}`} />;
    const j = joursRestants(exp);
    const st = habStatut(j) ?? "vert";
    return <Dot color={HAB_COLOR[st]} title={`${c.nom} — ${j !== null && j < 0 ? `expirée (${-j} j)` : `${j} j`} (éch. ${fmtDate(exp)})${auTxt}`} />;
  }

  const anyAutor = rows.some((r) => r.competence?.a_autorisation_conduite);
  const seg = (v: "grille" | "liste") => ({ className: view === v ? "seg active" : "seg", onClick: () => setView(v), type: "button" as const });

  return (
    <>
      {/* Recherche multi-critères + bascule de vue + bouton MàJ */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, margin: "0 0 14px", flexWrap: "wrap" }}>
        <span style={{ position: "relative", display: "inline-block", width: 320, maxWidth: "90vw" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Rechercher (nom, formation, groupe…)"
            style={{ width: "100%", padding: "7px 28px 7px 12px", borderRadius: 999, border: "1px solid var(--border)", fontSize: 13 }} />
          {search && (
            <button type="button" onClick={() => setSearch("")} title="Effacer"
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: "auto", margin: 0, padding: 0, border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>✕</button>
          )}
        </span>
        <div className="segments">
          <button {...seg("grille")}>Grille</button>
          <button {...seg("liste")}>Liste</button>
        </div>
        {children && (
          <button type="button" onClick={() => setShowMaj(true)} style={{ width: "auto", padding: "8px 22px", fontSize: 15, fontWeight: 700 }}>
            MàJ
          </button>
        )}
      </div>

      {view === "grille" ? (
        <div className="card" style={{ overflow: "auto", maxHeight: "calc(100vh - 300px)", padding: "6px 10px" }}>
          <table className="matrix" style={{ borderCollapse: "collapse", width: "auto" }}>
            <thead>
              <tr>
                <th rowSpan={3} style={{ position: "sticky", left: 0, top: 0, zIndex: 4, background: "#fff", textAlign: "left", minWidth: 180, verticalAlign: "bottom" }}>Personne</th>
                {catSpans.map((c, i) => (
                  <th key={i} colSpan={c.span} style={{ position: "sticky", top: 0, zIndex: 2, background: "#eef2ff", borderLeft: "2px solid #94a3b8", fontSize: 12, padding: "3px 4px" }}>{c.label}</th>
                ))}
              </tr>
              <tr>
                {grpSpans.map((g, i) => (
                  <th key={i} colSpan={g.span} style={{ position: "sticky", top: 22, zIndex: 2, background: "#f1f5f9", borderLeft: "1px solid #cbd5e1", fontSize: 11, fontWeight: 600, padding: "2px 4px" }}>{g.label}</th>
                ))}
              </tr>
              <tr>
                {shownOrdered.map((c) => (
                  <th key={c.id} title={c.nom} style={{ position: "sticky", top: 44, zIndex: 1, background: "#f8fafc", height: 120, verticalAlign: "bottom", padding: "4px 2px" }}>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", margin: "0 auto", fontSize: 11, maxHeight: 112, overflow: "hidden" }}>
                      {c.a_autorisation_conduite ? "🚜 " : ""}{c.nom}
                    </div>
                  </th>
                ))}
                {shownOrdered.length === 0 && <th className="muted">Aucune formation</th>}
              </tr>
            </thead>
            <tbody>
              {shownPersonnes.map((p) => (
                <tr key={p.id}>
                  <td style={{ position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>{p.nom} {p.prenom}</td>
                  {shownOrdered.map((c) => (
                    <td key={c.id} style={{ textAlign: "center", padding: "3px 6px" }}>{cellDot(p.id, c)}</td>
                  ))}
                </tr>
              ))}
              {shownPersonnes.length === 0 && (
                <tr><td colSpan={shownOrdered.length + 1} className="muted" style={{ padding: 10 }}>Aucun résultat.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card section">
          <table>
            <thead>
              <tr>
                <th>Personne</th>
                <th>Formation</th>
                <th>Passage</th>
                <th>Échéance</th>
                {anyAutor && <th>Autorisation conduite</th>}
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {shownRows.map((r) => {
                const exp = effExp(r, compById.get(r.competence_id));
                const j = joursRestants(exp);
                const st = exp ? habStatut(j) : "vert";
                return (
                  <tr key={r.id}>
                    <td>{r.personne ? `${r.personne.nom} ${r.personne.prenom}` : "?"}</td>
                    <td>{r.competence?.nom ?? "?"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date_obtention)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{exp ? fmtDate(exp) : <span className="muted">-</span>}</td>
                    {anyAutor && <td style={{ whiteSpace: "nowrap" }}>{r.competence?.a_autorisation_conduite ? fmtDate(r.date_autorisation_conduite) : <span className="muted">—</span>}</td>}
                    <td>
                      {st && (
                        <span className="tag" style={{ background: HAB_COLOR[st], color: "#fff" }}>
                          {!exp ? "valide" : j !== null && j < 0 ? `expirée (${-j} j)` : `${j} j`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shownRows.length === 0 && (
                <tr><td colSpan={anyAutor ? 6 : 5} className="muted">{rows.length === 0 ? "Aucune habilitation enregistrée." : "Aucun résultat pour cette recherche."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Légende */}
      <p className="muted" style={{ marginTop: 10 }}>
        <span style={{ color: HAB_COLOR.vert }}>●</span> valable (&gt; 90 j ou sans date de validité) ·{" "}
        <span style={{ color: HAB_COLOR.orange }}>●</span> bientôt dépassée (30-90 j) ·{" "}
        <span style={{ color: HAB_COLOR.rouge }}>●</span> plus valide (&lt; 30 j ou expirée) ·{" "}
        <span style={{ color: "#cbd5e1" }}>·</span> non habilité · 🚜 = autorisation de conduite (date par personne)
      </p>

      {/* Modale de mise à jour des habilitations */}
      {children && showMaj && (
        <div
          onClick={() => setShowMaj(false)}
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflow: "auto" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640 }}>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>Mise à jour des habilitations</h2>
                <button type="button" onClick={() => setShowMaj(false)} title="Fermer" style={{ width: "auto", margin: 0, padding: "2px 10px", fontSize: 16 }}>✕</button>
              </div>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
