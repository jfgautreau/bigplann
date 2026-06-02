"use client";

import { useState } from "react";

type Niveau = "none" | "read" | "write";
type RoleOpt = { key: string; label: string };
type ModuleOpt = { key: string; label: string };

const NEXT: Record<Niveau, Niveau> = { none: "read", read: "write", write: "none" };
const STYLE: Record<Niveau, { bg: string; fg: string; label: string; border: string }> = {
  none: { bg: "#ffffff", fg: "#6b7280", label: "Aucun", border: "1px solid #cbd5e1" },
  read: { bg: "#1d4ed8", fg: "#ffffff", label: "Lecture", border: "1px solid #1d4ed8" },
  write: { bg: "#7c3aed", fg: "#ffffff", label: "Modif.", border: "1px solid #7c3aed" },
};

export default function DroitsMatrix({
  roles,
  modules,
  initial,
}: {
  roles: RoleOpt[]; // tous les roles, admin inclus
  modules: ModuleOpt[];
  initial: Record<string, Record<string, Niveau>>; // par role (hors admin)
}) {
  const [m, setM] = useState<Record<string, Record<string, Niveau>>>(initial);

  function cycle(role: string, mod: string) {
    setM((prev) => {
      const cur = prev[role]?.[mod] ?? "none";
      return { ...prev, [role]: { ...(prev[role] ?? {}), [mod]: NEXT[cur] } };
    });
  }

  return (
    <table className="matrix" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", position: "sticky", left: 0, background: "#fff" }}>Module</th>
          {roles.map((r) => (
            <th key={r.key} style={{ textAlign: "center", minWidth: 92 }}>{r.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {modules.map((mod) => (
          <tr key={mod.key}>
            <td style={{ position: "sticky", left: 0, background: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
              {mod.label}
            </td>
            {roles.map((r) => {
              if (r.key === "admin") {
                return (
                  <td key={r.key} style={{ textAlign: "center" }}>
                    <span className="muted">Tout</span>
                  </td>
                );
              }
              const niv = m[r.key]?.[mod.key] ?? "none";
              const st = STYLE[niv];
              return (
                <td key={r.key} style={{ textAlign: "center", padding: 3 }}>
                  <input type="hidden" name={`cell_${r.key}_${mod.key}`} value={niv} />
                  <button
                    type="button"
                    onClick={() => cycle(r.key, mod.key)}
                    title="Cliquer pour changer : Aucun -> Lecture -> Modif."
                    style={{
                      margin: 0,
                      width: 78,
                      padding: "5px 6px",
                      background: st.bg,
                      color: st.fg,
                      border: st.border,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {st.label}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
