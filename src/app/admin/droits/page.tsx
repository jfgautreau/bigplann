import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { MODULES, getAllPermissions } from "@/lib/permissions";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { saveDroits } from "./actions";

export default async function DroitsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const all = await getAllPermissions();

  return (
    <>
      <AppHeader role={profile.role} active="/admin/droits" />
      <div className="container" style={{ maxWidth: 1100 }}>
        <h1>Droits d&apos;acces (role x module)</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Pour chaque rôle et module : <strong>Aucun</strong> (caché), <strong>Lecture</strong>
          (voit), <strong>Modification</strong> (peut éditer). L&apos;administrateur a tous les
          droits. La sécurité base (RLS) reste un garde-fou : certaines écritures sensibles
          restent réservées à l&apos;admin / au chef d&apos;équipe.
        </p>

        <form action={saveDroits}>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="matrix" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", position: "sticky", left: 0, background: "#fff" }}>Module</th>
                  {ROLES.map((r) => (
                    <th key={r} style={{ textAlign: "center" }}>{ROLE_LABELS[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.key}>
                    <td style={{ position: "sticky", left: 0, background: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {m.label}
                    </td>
                    {ROLES.map((r) => (
                      <td key={r} style={{ textAlign: "center" }}>
                        {r === "admin" ? (
                          <span className="muted">Tout</span>
                        ) : (
                          <select name={`cell_${r}_${m.key}`} defaultValue={all[r]?.[m.key] ?? "none"}>
                            <option value="none">Aucun</option>
                            <option value="read">Lecture</option>
                            <option value="write">Modif.</option>
                          </select>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" style={{ marginTop: 16, width: "auto", padding: "10px 20px" }}>
            Enregistrer les droits
          </button>
        </form>
      </div>
    </>
  );
}
