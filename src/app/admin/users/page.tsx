import { getServerClient } from "@/lib/supabase-server";
import { roleLabel, ROLES, ROLE_LABELS } from "@/lib/roles";
import AppHeader from "@/components/AppHeader";
import { requireModule, canWrite, MODULES, getAllPermissions } from "@/lib/permissions";
import LectureSeule from "@/components/LectureSeule";
import NouvelUtilisateur from "./NouvelUtilisateur";
import UserRoleSelect from "./UserRoleSelect";
import UserRowActions from "./UserRowActions";
import DroitsMatrix from "./DroitsMatrix";

type Row = {
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
};

export default async function AdminUsersPage() {
  const { profile, perms } = await requireModule("utilisateurs", "read");

  const supabase = await getServerClient();
  const { data: users } = await supabase
    .from("app_user")
    .select("user_id, email, name, role, is_active")
    .order("created_at", { ascending: true })
    .returns<Row[]>();

  const list = users ?? [];

  // La matrice s'edite avec le droit « utilisateurs: write » — pas reservee au
  // seul role admin, qui l'obtient de toute facon par la matrice.
  const peutEditerDroits = canWrite(perms, "utilisateurs");
  const allPerms = peutEditerDroits ? await getAllPermissions() : null;

  return (
    <>
      <AppHeader role={profile.role} active="/admin/users" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <h1>Utilisateurs</h1>

        <LectureSeule actif={!canWrite(perms, "utilisateurs")}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Comptes ({list.length})</h2>
            <NouvelUtilisateur />
          </div>
          <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>
            Le rôle est <strong>enregistré dès que vous le changez</strong>. Le mot de passe n&apos;est
            jamais choisi par l&apos;administrateur : « Lien de mot de passe » produit une adresse à
            transmettre, et la personne définit elle-même le sien.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>Nom</th>
                  <th style={{ width: "24%" }}>Email</th>
                  <th style={{ width: "23%" }}>Rôle</th>
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
                          <UserRoleSelect userId={u.user_id} role={u.role} />
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
        </div>

        {peutEditerDroits && allPerms && (
          <div className="card" style={{ marginTop: 24 }}>
            <h2>Droits d&apos;accès (rôle × module)</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              Cliquez sur une case pour changer le droit :{" "}
              <span style={{ background: "#fff", border: "1px solid #cbd5e1", padding: "1px 8px", borderRadius: 5 }}>Aucun</span>{" "}
              &rarr; <span style={{ background: "#1d4ed8", color: "#fff", padding: "1px 8px", borderRadius: 5 }}>Lecture</span>{" "}
              &rarr; <span style={{ background: "#7c3aed", color: "#fff", padding: "1px 8px", borderRadius: 5 }}>Modif.</span>.
              Votre propre rôle apparaît <strong>grisé</strong> : on ne modifie pas ses
              propres droits, sous peine de ne plus pouvoir rouvrir cet écran. Vous ne
              pouvez pas non plus accorder un droit que vous n&apos;avez pas vous-même.
              Chaque changement est <strong>enregistré automatiquement</strong>. La
              sécurité base (RLS) reste un garde-fou.
            </p>
            <div style={{ overflowX: "auto" }}>
              <DroitsMatrix
                roles={ROLES.map((r) => ({ key: r, label: ROLE_LABELS[r] }))}
                modules={MODULES.map((m) => ({ key: m.key, label: m.label }))}
                initial={Object.fromEntries(ROLES.map((r) => [r, allPerms[r]]))}
                roleAppelant={profile.role}
                permsAppelant={perms}
              />
            </div>
          </div>
        )}
        </LectureSeule>
      </div>
    </>
  );
}
