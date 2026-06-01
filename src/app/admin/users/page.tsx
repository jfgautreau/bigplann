import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { roleLabel } from "@/lib/roles";
import UserForm from "./UserForm";

type Row = {
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
};

export default async function AdminUsersPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: caller } = await supabase
    .from("app_user")
    .select("role")
    .eq("user_id", user.id)
    .single<{ role: string }>();
  if (caller?.role !== "admin") redirect("/");

  const { data: users } = await supabase
    .from("app_user")
    .select("user_id, email, name, role, is_active")
    .order("created_at", { ascending: true })
    .returns<Row[]>();

  const list = users ?? [];

  return (
    <div className="container">
      <div className="topbar">
        <strong>
          <Link href="/">Planning Usine</Link> / Utilisateurs
        </strong>
        <form action="/logout" method="post">
          <button type="submit">Se deconnecter</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h1>Inviter un utilisateur</h1>
        <UserForm />
        <p className="muted" style={{ marginTop: 12 }}>
          L&apos;invite recoit un email, definit son mot de passe, puis accede a
          l&apos;application avec le role choisi.
        </p>
      </div>

      <div className="card">
        <h1>Utilisateurs ({list.length})</h1>
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
  );
}
