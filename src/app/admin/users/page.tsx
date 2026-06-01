import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { roleLabel } from "@/lib/roles";
import AppHeader from "@/components/AppHeader";
import UserForm from "./UserForm";

type Row = {
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
};

export default async function AdminUsersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await getServerClient();
  const { data: users } = await supabase
    .from("app_user")
    .select("user_id, email, name, role, is_active")
    .order("created_at", { ascending: true })
    .returns<Row[]>();

  const list = users ?? [];

  return (
    <>
      <AppHeader role={profile.role} active="/admin/users" />
      <div className="container">
        <h1>Utilisateurs</h1>

        <div className="card" style={{ marginBottom: 24 }}>
          <h2>Ajouter un utilisateur</h2>
          <UserForm />
          <p className="muted" style={{ marginTop: 12 }}>
            Le compte est cree directement avec un mot de passe (acces immediat).
            Communiquez-le a l&apos;utilisateur, qui pourra le changer ensuite.
          </p>
        </div>

        <div className="card">
          <h2>Comptes ({list.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Role</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.name || "-"}</td>
                  <td>{u.email}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>{u.is_active ? "Actif" : "Desactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
