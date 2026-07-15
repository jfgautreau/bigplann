import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { roleLabel, ROLES, ROLE_LABELS } from "@/lib/roles";
import AppHeader from "@/components/AppHeader";
import { requireModule, MODULES, getAllPermissions } from "@/lib/permissions";
import UserForm from "./UserForm";
import UserRowActions from "./UserRowActions";
import DroitsMatrix from "./DroitsMatrix";
import { updateUserRole } from "./actions";

type Row = {
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
};

export default async function AdminUsersPage() {
  const { profile } = await requireModule("utilisateurs", "write");

  const supabase = await getServerClient();
  const { data: users } = await supabase
    .from("app_user")
    .select("user_id, email, name, role, is_active")
    .order("created_at", { ascending: true })
    .returns<Row[]>();

  const list = users ?? [];

  // Matrice des droits (role x module) : reservee a l'administrateur.
  const isAdmin = profile.role === "admin";
  const allPerms = isAdmin ? await getAllPermissions() : null;

  return (
    <>
      <AppHeader role={profile.role} active="/admin/users" />
      <div className="container">
        <h1>Utilisateurs</h1>

        <div className="card" style={{ marginBottom: 24 }}>
          <h2>Ajouter un utilisateur</h2>
          <UserForm />
          <p className="muted" style={{ marginTop: 12 }}>
            Le compte est créé directement avec un mot de passe (accès immédiat).
            Communiquez-le à l&apos;utilisateur, qui pourra le changer ensuite.
          </p>
        </div>

        <div className="card">
          <h2>Comptes ({list.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Compte</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const isSelf = u.user_id === profile.authId;
                return (
                  <tr key={u.user_id}>
                    <td>{u.name || "-"}</td>
                    <td>{u.email}</td>
                    <td>
                      {isSelf ? (
                        <span>
                          {roleLabel(u.role)} <span className="muted">(vous)</span>
                        </span>
                      ) : (
                        <form action={updateUserRole} className="inline-form" style={{ margin: 0 }}>
                          <input type="hidden" name="user_id" value={u.user_id} />
                          <select key={u.role} name="role" defaultValue={u.role}>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="btn-sm btn-ghost">
                            Enregistrer
                          </button>
                        </form>
                      )}
                    </td>
                    <td>
                      <UserRowActions userId={u.user_id} isActive={u.is_active} isSelf={isSelf} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isAdmin && allPerms && (
          <div className="card" style={{ marginTop: 24 }}>
            <h2>Droits d&apos;accès (rôle × module)</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              Cliquez sur une case pour changer le droit :{" "}
              <span style={{ background: "#fff", border: "1px solid #cbd5e1", padding: "1px 8px", borderRadius: 5 }}>Aucun</span>{" "}
              &rarr; <span style={{ background: "#1d4ed8", color: "#fff", padding: "1px 8px", borderRadius: 5 }}>Lecture</span>{" "}
              &rarr; <span style={{ background: "#7c3aed", color: "#fff", padding: "1px 8px", borderRadius: 5 }}>Modif.</span>.
              L&apos;administrateur a tous les droits. Chaque changement est <strong>enregistré
              automatiquement</strong>. La sécurité base (RLS) reste un garde-fou.
            </p>
            <div style={{ overflowX: "auto" }}>
              <DroitsMatrix
                roles={ROLES.map((r) => ({ key: r, label: ROLE_LABELS[r] }))}
                modules={MODULES.map((m) => ({ key: m.key, label: m.label }))}
                initial={Object.fromEntries(ROLES.filter((r) => r !== "admin").map((r) => [r, allPerms[r]]))}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
