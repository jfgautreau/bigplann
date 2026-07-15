"use client";

import { useMemo, useState } from "react";
import { joursRestants, habStatut, addMonthsIso, HAB_COLOR, type HabStatut } from "@/lib/habilitations";
import { usePersonGrid } from "@/components/usePersonGrid";
import g from "@/components/persongrid.module.css";
import HabMark from "./HabMark";
import HabLegendeModal from "./HabLegendeModal";

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

// Compteur du bilan : grand nombre teinte + libelle.
function Kpi({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4px 14px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "#fff",
        minWidth: 88,
      }}
    >
      <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color }}>{n}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

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
  const [showLegende, setShowLegende] = useState(false);
  const [showBilan, setShowBilan] = useState(false);
  const { headCardRef, headTableRef, rowsTableRef, rowsCardProps } = usePersonGrid(g.colHover, 3);

  const compById = useMemo(() => new Map(comps.map((c) => [c.id, c])), [comps]);

  const q = search.trim();
  // Recherche multi-critères : nom de personne, mais aussi formation / groupe / catégorie.
  const personMatch = (p: { nom: string; prenom: string }) => norm(`${p.nom} ${p.prenom}`).includes(norm(q));
  const compMatch = (c: Comp) => norm(`${c.nom} ${c.groupe ?? ""} ${CAT_LABEL[catOf(c.categorie)]}`).includes(norm(q));

  // Enregistrement par (personne, formation).
  const recMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) m.set(`${r.personne_id}:${r.competence_id}`, r);
    return m;
  }, [rows]);

  // Bilan (global + par formation), independant de la recherche. Base sur recMap
  // (etat courant : une entree par personne x formation, comme la grille) pour ne
  // pas compter deux fois un recyclage. Restreint aux personnes actives.
  const bilan = useMemo(() => {
    const actifs = new Set(personnes.map((p) => p.id));
    const formeesSet = new Set<string>();
    let valables = 0;
    let expirees = 0;
    const parComp = new Map<string, { formees: number; valables: number; expirees: number }>();
    for (const c of comps) parComp.set(c.id, { formees: 0, valables: 0, expirees: 0 });
    for (const rec of recMap.values()) {
      if (!actifs.has(rec.personne_id)) continue;
      const st = parComp.get(rec.competence_id);
      if (!st) continue; // formation inactive / non listee
      formeesSet.add(rec.personne_id);
      st.formees++;
      const j = joursRestants(effExp(rec, compById.get(rec.competence_id)));
      if (j !== null && j < 0) {
        expirees++;
        st.expirees++;
      } else {
        valables++;
        st.valables++;
      }
    }
    return { global: { formees: formeesSet.size, valables, expirees }, parComp };
  }, [recMap, personnes, comps, compById]);

  // Colonnes ordonnées.
  const ordered = useMemo(
    () =>
      [...comps].sort(
        (a, b) => CAT_ORDER.indexOf(catOf(a.categorie)) - CAT_ORDER.indexOf(catOf(b.categorie)) || a.ordre - b.ordre || a.nom.localeCompare(b.nom)
      ),
    [comps]
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

  // Bandeaux d'en-tete : categories puis groupes. `debutGroupe` marque la premiere
  // colonne de chaque groupe (separateur plus marque, comme la matrice).
  const catSpans: { key: string; label: string; span: number }[] = [];
  const grpSpans: { key: string; label: string; span: number }[] = [];
  const debutGroupe = new Set<string>();
  for (const c of shownOrdered) {
    const ck = catOf(c.categorie);
    if (!catSpans.length || catSpans[catSpans.length - 1].key !== ck) catSpans.push({ key: ck, label: CAT_LABEL[ck], span: 1 });
    else catSpans[catSpans.length - 1].span++;
    const gk = `${ck}|${c.groupe ?? "—"}`;
    if (!grpSpans.length || grpSpans[grpSpans.length - 1].key !== gk) {
      grpSpans.push({ key: gk, label: c.groupe ?? "—", span: 1 });
      debutGroupe.add(c.id);
    } else grpSpans[grpSpans.length - 1].span++;
  }

  // Colonne noms adaptative, partagee par les 2 tables -> colonnes alignees.
  const nameW = Math.min(320, Math.max(150, personnes.reduce((m, p) => Math.max(m, `${p.nom} ${p.prenom}`.length), 0) * 7.2 + 30));
  const cols = useMemo(
    () => (
      <colgroup>
        <col style={{ width: nameW }} />
        {shownOrdered.map((c) => (
          <col key={c.id} />
        ))}
      </colgroup>
    ),
    [nameW, shownOrdered]
  );

  // Statut + infobulle d'une case.
  function cellOf(personId: string, c: Comp): { statut: HabStatut | "aucun"; title: string } {
    const rec = recMap.get(`${personId}:${c.id}`);
    if (!rec) return { statut: "aucun", title: `${c.nom} — non habilité` };
    const auTxt = rec.date_autorisation_conduite ? ` · autorisation ${fmtDate(rec.date_autorisation_conduite)}` : "";
    const exp = effExp(rec, c);
    if (!exp) return { statut: "vert", title: `${c.nom} — valable (pas de date de validité)${auTxt}` };
    const j = joursRestants(exp);
    const st = habStatut(j) ?? "vert";
    return { statut: st, title: `${c.nom} — ${j !== null && j < 0 ? `expirée (${-j} j)` : `${j} j`} (éch. ${fmtDate(exp)})${auTxt}` };
  }

  const anyAutor = rows.some((r) => r.competence?.a_autorisation_conduite);
  const seg = (v: "grille" | "liste") => ({ className: view === v ? "seg active" : "seg", onClick: () => setView(v), type: "button" as const });

  const searchRow = (
    <div className={g.searchRow}>
      <span className={g.searchWrap}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Rechercher (nom, formation, groupe…)"
          className={g.searchInput}
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} title="Effacer" className={g.searchClear}>
            ✕
          </button>
        )}
      </span>
      <button type="button" className={`btn-sm btn-ghost ${g.legendBtn}`} onClick={() => setShowLegende(true)}>
        📖 Légende
      </button>
    </div>
  );

  return (
    <>
      {/* Bilan + bascule de vue : bandeau centre de 1500 px, comme la matrice. */}
      <div className="headband">
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Kpi n={bilan.global.formees} label="Personnes formées" color="#1d4ed8" />
            <Kpi n={bilan.global.valables} label="Habilitations valables" color="#16a34a" />
            <Kpi n={bilan.global.expirees} label="Habilitations expirées" color="#dc2626" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="segments">
            <button {...seg("grille")}>Grille</button>
            <button {...seg("liste")}>Liste</button>
          </div>
          {children && (
            <button type="button" onClick={() => setShowMaj(true)} style={{ width: "auto", margin: 0, padding: "7px 22px", fontSize: 14, fontWeight: 700 }}>
              MàJ
            </button>
          )}
          </div>
        </div>
      </div>

      <div className="gridband">
        {view === "grille" ? (
          <div
            className={g.grid}
            style={{
              "--name-w": `${nameW}px`,
              "--n-cols": shownOrdered.length,
              "--sub-top": "22px",
              "--col-top": "44px",
              // En-tetes bleus + traits verticaux identiques a la matrice (mode Actuel).
              "--accent": "#1d4ed8",
              "--accent-bg": "#dbeafe",
              "--accent-soft": "#1d4ed855",
            } as React.CSSProperties}
          >
            {searchRow}

            {/* Tableau 1 : en-tetes figes (categorie / groupe / formation) */}
            <div className={`card ${g.headCard}`} ref={headCardRef}>
              <table className={`matrix ${g.table}`} ref={headTableRef}>
                {cols}
                <thead>
                  <tr>
                    <th rowSpan={3} className={g.cornerHead}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
                        <span>Personne</span>
                        <button
                          type="button"
                          onClick={() => setShowBilan((b) => !b)}
                          title={showBilan ? "Masquer le bilan" : "Afficher le bilan par formation"}
                          className={g.bilanToggle}
                        >
                          {showBilan ? "− Bilan" : "+ Bilan"}
                        </button>
                      </div>
                    </th>
                    {catSpans.map((c) => (
                      <th key={c.key} colSpan={c.span} className={g.groupHead} title={c.label}>
                        <div className={g.groupLabel}>{c.label}</div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {grpSpans.map((gr) => (
                      <th key={gr.key} colSpan={gr.span} className={g.subHead} title={gr.label}>
                        <div className={g.groupLabel}>{gr.label}</div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {shownOrdered.map((c) => (
                      <th key={c.id} title={c.nom} className={debutGroupe.has(c.id) ? `${g.colHead} ${g.groupStart}` : g.colHead}>
                        <div className={g.colLabel}>
                          {c.a_autorisation_conduite ? "🚜 " : ""}
                          {c.nom}
                        </div>
                      </th>
                    ))}
                    {shownOrdered.length === 0 && <th className="muted">Aucune formation</th>}
                  </tr>
                </thead>
                {showBilan && (
                  <tbody>
                    {([
                      ["Personnes formées", "#1d4ed8", "formees"],
                      ["Habilitations valables", "#16a34a", "valables"],
                      ["Habilitations expirées", "#dc2626", "expirees"],
                    ] as const).map(([label, color, field]) => (
                      <tr key={field} className={g.bilanRow}>
                        <td className={g.bilanLabel} style={{ color }}>{label}</td>
                        {shownOrdered.map((c) => {
                          const n = bilan.parComp.get(c.id)?.[field] ?? 0;
                          return (
                            <td key={c.id} className={g.bilanCell} style={{ color: n > 0 ? color : "#cbd5e1" }}>
                              {n || ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>

            {/* Tableau 2 : personnes (defile, occupe la hauteur restante) */}
            <div className={`card ${g.rowsCard}`} {...rowsCardProps}>
              <table className={`matrix ${g.table} ${g.rowsTable}`} ref={rowsTableRef}>
                {cols}
                <tbody>
                  {shownPersonnes.map((p) => (
                    <tr key={p.id}>
                      <td className={g.nameCell}>
                        {p.nom} {p.prenom}
                      </td>
                      {shownOrdered.map((c) => {
                        const { statut, title } = cellOf(p.id, c);
                        return (
                          <td key={c.id} className={g.cellTd}>
                            <span className={g.cellMark} title={`${p.nom} ${p.prenom}\n${title}`}>
                              <HabMark statut={statut} />
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {shownPersonnes.length === 0 && (
                    <tr>
                      <td colSpan={shownOrdered.length + 1} className="muted" style={{ padding: 10 }}>
                        Aucun résultat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            {searchRow}
            <div className="card grow" style={{ overflow: "auto" }}>
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
                        {anyAutor && (
                          <td style={{ whiteSpace: "nowrap" }}>
                            {r.competence?.a_autorisation_conduite ? fmtDate(r.date_autorisation_conduite) : <span className="muted">—</span>}
                          </td>
                        )}
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
                    <tr>
                      <td colSpan={anyAutor ? 6 : 5} className="muted">
                        {rows.length === 0 ? "Aucune habilitation enregistrée." : "Aucun résultat pour cette recherche."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showLegende && <HabLegendeModal onClose={() => setShowLegende(false)} />}

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
                <button type="button" onClick={() => setShowMaj(false)} title="Fermer" style={{ width: "auto", margin: 0, padding: "2px 10px", fontSize: 16 }}>
                  ✕
                </button>
              </div>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
