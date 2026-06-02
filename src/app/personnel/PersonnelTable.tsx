"use client";

import Link from "next/link";
import { useState } from "react";

type Row = {
  id: string;
  matricule: string | null;
  nom: string;
  prenom: string;
  equipe: string;
  type_contrat: string;
  pointure: string;
  statut: string;
};

const COLS: { key: keyof Row; label: string }[] = [
  { key: "matricule", label: "Matricule" },
  { key: "nom", label: "Nom" },
  { key: "prenom", label: "Prenom" },
  { key: "equipe", label: "Equipe" },
  { key: "type_contrat", label: "Contrat" },
  { key: "pointure", label: "Pointure" },
  { key: "statut", label: "Statut" },
];

export default function PersonnelTable({
  rows,
  isAdmin,
}: {
  rows: Row[];
  isAdmin: boolean;
}) {
  const [q, setQ] = useState<Record<string, string>>({});

  const filtered = rows.filter((r) =>
    COLS.every((c) => {
      const needle = (q[c.key] ?? "").trim().toLowerCase();
      if (!needle) return true;
      return String(r[c.key] ?? "").toLowerCase().includes(needle);
    })
  );

  return (
    <div className="card">
      <p className="muted" style={{ marginBottom: 8 }}>
        {filtered.length} / {rows.length} personne(s) — tapez sous une colonne pour filtrer.
      </p>
      <table>
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {isAdmin && <th></th>}
          </tr>
          <tr>
            {COLS.map((c) => (
              <th key={c.key} style={{ padding: 4 }}>
                <input
                  value={q[c.key] ?? ""}
                  onChange={(e) => setQ((s) => ({ ...s, [c.key]: e.target.value }))}
                  placeholder="rechercher"
                  style={{ width: "100%", fontSize: 12, padding: "4px 6px", fontWeight: 400 }}
                />
              </th>
            ))}
            {isAdmin && <th style={{ padding: 4 }}></th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td>{r.matricule || "-"}</td>
              <td>{r.nom}</td>
              <td>{r.prenom}</td>
              <td>{r.equipe || "-"}</td>
              <td>{r.type_contrat}</td>
              <td>{r.pointure || "-"}</td>
              <td>
                <span className={r.statut === "ACTIF" ? "tag" : "tag tag-off"}>
                  {r.statut === "ACTIF" ? "Actif" : "Parti"}
                </span>
              </td>
              {isAdmin && (
                <td>
                  <Link href={`/personnel/${r.id}`}>Modifier</Link>
                </td>
              )}
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 8 : 7} className="muted">
                Aucun resultat.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
