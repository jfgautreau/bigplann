"use client";

import { useState } from "react";
import { joursRestants, habStatut, HAB_COLOR } from "@/lib/habilitations";

type Row = {
  id: string;
  date_obtention: string | null;
  date_expiration: string | null;
  personne: { nom: string; prenom: string } | null;
  competence: { nom: string; a_recycler: boolean } | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Ordre de la page : recherche par nom, (formulaire en `children`), liste, legende.
export default function HabilitationsList({
  rows,
  canEdit,
  deleteHabilitation,
  children,
}: {
  rows: Row[];
  canEdit: boolean;
  deleteHabilitation: (formData: FormData) => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const shown = search.trim()
    ? rows.filter((r) => norm(`${r.personne?.nom ?? ""} ${r.personne?.prenom ?? ""}`).includes(norm(search)))
    : rows;

  return (
    <>
      {/* 1. Recherche par nom (haut de page, centrée) */}
      <div style={{ display: "flex", justifyContent: "center", margin: "0 0 14px" }}>
        <span style={{ position: "relative", display: "inline-block", width: 340, maxWidth: "90vw" }}>
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
      </div>

      {/* 2. Mise à jour des habilitations (formulaire fourni par la page) */}
      {children}

      {/* 3. Liste des habilitations en cours */}
      <div className="card section">
        <table>
          <thead>
            <tr>
              <th>Personne</th>
              <th>Habilitation</th>
              <th>Obtention</th>
              <th>Expiration</th>
              <th>Échéance</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
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
                  {canEdit && (
                    <td>
                      <form action={deleteHabilitation} style={{ margin: 0 }}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="btn-sm btn-ghost">Supprimer</button>
                      </form>
                    </td>
                  )}
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="muted">
                  {rows.length === 0 ? "Aucune habilitation enregistrée." : "Aucun résultat pour cette recherche."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Légende en bas de page */}
      <p className="muted" style={{ marginTop: 10 }}>
        <span style={{ color: HAB_COLOR.vert }}>●</span> &gt; 90 j ·{" "}
        <span style={{ color: HAB_COLOR.orange }}>●</span> 30-90 j ·{" "}
        <span style={{ color: HAB_COLOR.rouge }}>●</span> &lt; 30 j ou expirée
      </p>
    </>
  );
}
