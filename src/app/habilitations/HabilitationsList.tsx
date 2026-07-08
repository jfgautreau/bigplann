"use client";

import { useState } from "react";
import { joursRestants, habStatut, HAB_COLOR } from "@/lib/habilitations";

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

  const matchName = (nom: string, prenom: string) => norm(`${nom} ${prenom}`).includes(norm(search));
  const shownRows = search.trim() ? rows.filter((r) => r.personne && matchName(r.personne.nom, r.personne.prenom)) : rows;
  const shownPersonnes = search.trim() ? personnes.filter((p) => matchName(p.nom, p.prenom)) : personnes;

  // Enregistrement par (personne, formation).
  const recMap = new Map<string, Row>();
  for (const r of rows) recMap.set(`${r.personne_id}:${r.competence_id}`, r);

  // Colonnes ordonnées + regroupement catégorie / groupe.
  const ordered = [...comps].sort(
    (a, b) => CAT_ORDER.indexOf(catOf(a.categorie)) - CAT_ORDER.indexOf(catOf(b.categorie)) || a.ordre - b.ordre || a.nom.localeCompare(b.nom)
  );
  const catSpans: { key: string; label: string; span: number }[] = [];
  const grpSpans: { key: string; label: string; span: number }[] = [];
  for (const c of ordered) {
    const ck = catOf(c.categorie);
    if (!catSpans.length || catSpans[catSpans.length - 1].key !== ck) catSpans.push({ key: ck, label: CAT_LABEL[ck], span: 1 });
    else catSpans[catSpans.length - 1].span++;
    const gk = `${ck}|${c.groupe ?? "—"}`;
    if (!grpSpans.length || grpSpans[grpSpans.length - 1].key !== gk) grpSpans.push({ key: gk, label: c.groupe ?? "—", span: 1 });
    else grpSpans[grpSpans.length - 1].span++;
  }

  // Pastille : vert si valable (échéance OK ou pas de date de validité = à vie).
  const Dot = ({ color, title }: { color: string; title: string }) => (
    <span title={title} style={{ display: "inline-block", width: 13, height: 13, borderRadius: "50%", background: color, border: "1px solid rgba(0,0,0,0.15)" }} />
  );
  function cellDot(personId: string, c: Comp) {
    const rec = recMap.get(`${personId}:${c.id}`);
    if (!rec) return <span style={{ color: "#e2e8f0" }} title="Non habilité">·</span>;
    const auTxt = rec.date_autorisation_conduite ? ` · autorisation ${fmtDate(rec.date_autorisation_conduite)}` : "";
    if (!rec.date_expiration) return <Dot color={HAB_COLOR.vert} title={`${c.nom} — valable (pas de date de validité)${auTxt}`} />; // à vie -> vert
    const j = joursRestants(rec.date_expiration);
    const st = habStatut(j) ?? "vert";
    return <Dot color={HAB_COLOR[st]} title={`${c.nom} — ${j !== null && j < 0 ? `expirée (${-j} j)` : `${j} j`} (éch. ${fmtDate(rec.date_expiration)})${auTxt}`} />;
  }

  const anyAutor = rows.some((r) => r.competence?.a_autorisation_conduite);
  const seg = (v: "grille" | "liste") => ({ className: view === v ? "seg active" : "seg", onClick: () => setView(v), type: "button" as const });

  return (
    <>
      {/* Recherche par nom + bascule de vue */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, margin: "0 0 14px", flexWrap: "wrap" }}>
        <span style={{ position: "relative", display: "inline-block", width: 320, maxWidth: "90vw" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Rechercher un nom…"
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
      </div>

      {children}

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
                {ordered.map((c) => (
                  <th key={c.id} title={c.nom} style={{ position: "sticky", top: 44, zIndex: 1, background: "#f8fafc", height: 120, verticalAlign: "bottom", padding: "4px 2px" }}>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", margin: "0 auto", fontSize: 11, maxHeight: 112, overflow: "hidden" }}>
                      {c.a_autorisation_conduite ? "🚜 " : ""}{c.nom}
                    </div>
                  </th>
                ))}
                {ordered.length === 0 && <th className="muted">Aucune formation définie</th>}
              </tr>
            </thead>
            <tbody>
              {shownPersonnes.map((p) => (
                <tr key={p.id}>
                  <td style={{ position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>{p.nom} {p.prenom}</td>
                  {ordered.map((c) => (
                    <td key={c.id} style={{ textAlign: "center", padding: "3px 6px" }}>{cellDot(p.id, c)}</td>
                  ))}
                </tr>
              ))}
              {shownPersonnes.length === 0 && (
                <tr><td colSpan={ordered.length + 1} className="muted" style={{ padding: 10 }}>Aucun résultat.</td></tr>
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
                const j = joursRestants(r.date_expiration);
                const st = r.date_expiration ? habStatut(j) : "vert";
                return (
                  <tr key={r.id}>
                    <td>{r.personne ? `${r.personne.nom} ${r.personne.prenom}` : "?"}</td>
                    <td>{r.competence?.nom ?? "?"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date_obtention)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.date_expiration ? fmtDate(r.date_expiration) : <span className="muted">à vie</span>}</td>
                    {anyAutor && <td style={{ whiteSpace: "nowrap" }}>{r.competence?.a_autorisation_conduite ? fmtDate(r.date_autorisation_conduite) : <span className="muted">—</span>}</td>}
                    <td>
                      {st && (
                        <span className="tag" style={{ background: HAB_COLOR[st], color: "#fff" }}>
                          {!r.date_expiration ? "valide" : j !== null && j < 0 ? `expirée (${-j} j)` : `${j} j`}
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
    </>
  );
}
