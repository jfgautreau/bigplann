import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { roleLabel } from "@/lib/roles";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";

type Entry = {
  id: number;
  app_user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  created_at: string;
};
type AppUser = { user_id: string; name: string; email: string };

const ACTION_FR: Record<string, string> = {
  INSERT: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
};

export default async function JournalPage() {
  const { profile } = await requireModule("journal", "read");

  const supabase = await getServerClient();
  const [{ data: entriesData }, { data: usersData }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("id, app_user_id, action, table_name, record_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<Entry[]>(),
    supabase
      .from("app_user")
      .select("user_id, name, email")
      .returns<AppUser[]>(),
  ]);

  const entries = entriesData ?? [];
  const users = usersData ?? [];
  const who = (id: string | null) => {
    if (!id) return "Système";
    const u = users.find((x) => x.user_id === id);
    return u ? u.name || u.email : id.slice(0, 8);
  };

  return (
    <>
      <AppHeader role={profile.role} active="/journal" />
      <div className="container">
        <h1>Journal d&apos;audit</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          200 dernières modifications. Visible par l&apos;administrateur et le
          CODIR ({roleLabel(profile.role)}).
        </p>
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Table</th>
                <th>Enregistrement</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.created_at).toLocaleString("fr-FR")}</td>
                  <td>{who(e.app_user_id)}</td>
                  <td>{ACTION_FR[e.action] ?? e.action}</td>
                  <td>{e.table_name}</td>
                  <td>{e.record_id?.slice(0, 8) ?? "-"}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Aucune entrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
