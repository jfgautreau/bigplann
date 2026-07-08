"use client";

import { useState } from "react";
import { joursRestants, habStatut, HAB_COLOR } from "@/lib/habilitations";

type Row = {
  id: string;
  personne_id: string;
  competence_id: string;
  date_obtention: string | null;
  date_expiration: string | null;
  personne: { nom: string; prenom: string } | null;
  competence: { nom: string; a_recycler: boolean } | null;
};
type Personne = { id: string; nom: string; prenom: string };
type Comp = { id: string; nom: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Deux vues : liste (historique complet, non supprimable) et grille (personne x
// habilitation, pastille verte/orange/rouge selon l'echeance).
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
  const [view, setView] = useState<"liste" | "grille">("liste");

  const matchName = (nom: string, prenom: string) => norm(`${nom} ${prenom}`).includes(norm(search));
  const shownRows = search.trim()
    ? rows.filter((r) => r.personne && matchName(r.personne.nom, r.personne.prenom))
    : rows;
  const shownPersonnes = search.trim() ? personnes.filter((p) => matchName(p.nom, p.prenom)) : personnes;

  // Grille : echeance par (personne, habilitation).
  const expMap = new Map<string, string | null>();
  for (const r of rows) expMap.set(`${r.personne_id}:${r.competence_id}`, r.date_expiration);

  const Dot = ({ color, title }: { color: string; title: string }) => (
    <span title={title} style={{ display: "inline-block", width: 13, height: 13, borderRadius: "50%", background: color, border: "1px solid rgba(0,0,0,0.15)" }} />
  );

  const seg = (v: "liste" | "grille") => ({ className: view === v ? "seg active" : "seg", onClick: () => setView(v), type: "button" as const });

  return (
    <>
      {/* Recherche par nom + bascule de vue */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, margin: "0 0 14px", flexWrap: "wrap" }}>
        <span style={{ position: "relative", display: "inline-block", width: 320, maxWidth: "90vw" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Rechercher un nom…"
            style={{ width: "100%", padding: "7px 28px 7px 12px", borderRadius: 999, border: "1px solid var(--border)", fontSize: 13 }}
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} title="Effacer"
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: "auto", margin: 0, padding: 0, border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>✕</button>
          )}
        </span>
        <div className="segments">
          <button {...seg("liste")}>Liste</button>
          <button {...seg("grille")}>Grille</button>
        </div>
      </div>

      {/* Mise à jour des habilitations (formulaire fourni par la page) */}
      {children}

      {view === "liste" ? (
        <div className="card section">
          <table>
            <thead>
              <tr>
                <th>Personne</th>
                <th>Habilitation</th>
                <th>Obtention</th>
                <th>Expiration</th>
                <th>Échéance</th>
              </tr>
            </thead>
            <tbody>
              {shownRows.map((r) => {
                const j = joursRestants(r.date_expiration);
                const st = habStatut(j);
                return (
                  <tr key={r.id}>
                    <td>{r.personne ? `${r.personne.nom} ${r.personne.prenom}` : "?"}</td>
                    <td>{r.competence?.nom ?? "?"}</td>
                    <td>{r.date_obtention ?? "-"}</td>
                    <td>{r.date_expiration ?? "-"}</td>
                    <td>
                      {st && (
                        <span className="tag" style={{ background: HAB_COLOR[st], color: "#fff" }}>
                          {j !== null && j < 0 ? `expirée (${-j} j)` : `${j} j`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shownRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    {rows.length === 0 ? "Aucune habilitation enregistrée." : "Aucun résultat pour cette recherche."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ overflow: "auto", maxHeight: "calc(100vh - 320px)", padding: "6px 10px" }}>
          <table className="matrix" style={{ borderCollapse: "collapse", width: "auto" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: "#fff", textAlign: "left", minWidth: 180 }}>Personne</th>
                {comps.map((c) => (
                  <th key={c.id} title={c.nom} style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc", height: 120, verticalAlign: "bottom", padding: "4px 2px" }}>
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", margin: "0 auto", fontSize: 12, maxHeight: 110, overflow: "hidden" }}>{c.nom}</div>
                  </th>
                ))}
                {comps.length === 0 && <th className="muted">Aucune habilitation définie</th>}
              </tr>
            </thead>
            <tbody>
              {shownPersonnes.map((p) => (
                <tr key={p.id}>
                  <td style={{ position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>{p.nom} {p.prenom}</td>
                  {comps.map((c) => {
                    const exp = expMap.get(`${p.id}:${c.id}`);
                    const has = expMap.has(`${p.id}:${c.id}`);
                    const j = joursRestants(exp ?? null);
                    const st = habStatut(j);
                    return (
                      <td key={c.id} style={{ textAlign: "center", padding: "3px 6px" }}>
                        {has && st ? (
                          <Dot color={HAB_COLOR[st]} title={`${c.nom} — ${j !== null && j < 0 ? `expirée (${-j} j)` : `${j} j restants`}`} />
                        ) : has ? (
                          <span className="muted" title="Sans date d'expiration">•</span>
                        ) : (
                          <span style={{ color: "#e2e8f0" }} title="Non habilité">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {shownPersonnes.length === 0 && (
                <tr><td colSpan={comps.length + 1} className="muted" style={{ padding: 10 }}>Aucun résultat.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Légende en bas de page */}
      <p className="muted" style={{ marginTop: 10 }}>
        <span style={{ color: HAB_COLOR.vert }}>●</span> habilité (&gt; 90 j) ·{" "}
        <span style={{ color: HAB_COLOR.orange }}>●</span> bientôt dépassée (30-90 j) ·{" "}
        <span style={{ color: HAB_COLOR.rouge }}>●</span> plus valide (&lt; 30 j ou expirée)
        {view === "grille" && <> · <span style={{ color: "#cbd5e1" }}>·</span> non habilité</>}
      </p>
    </>
  );
}
