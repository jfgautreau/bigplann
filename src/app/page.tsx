import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { roleLabel } from "@/lib/roles";

export default async function DashboardPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("app_user")
    .select("name, role, email")
    .eq("user_id", user.id)
    .single<{ name: string; role: string; email: string }>();

  const name = profile?.name || profile?.email || user.email;
  const role = profile?.role ?? "direction";

  return (
    <div className="container">
      <div className="topbar">
        <strong>Planning Usine</strong>
        <form action="/logout" method="post">
          <button type="submit">Se deconnecter</button>
        </form>
      </div>

      <div className="card">
        <h1>Bienvenue, {name}</h1>
        <p className="muted">
          Connecte en tant que <strong>{roleLabel(role)}</strong> ({user.email}).
        </p>

        {role === "admin" && (
          <p style={{ marginTop: 16 }}>
            <Link href="/admin/users">Gestion des utilisateurs &rarr;</Link>
          </p>
        )}

        <p className="muted" style={{ marginTop: 24 }}>
          Socle Supabase + Vercel. Les modules metier seront ajoutes apres
          validation de ce socle.
        </p>
      </div>
    </div>
  );
}
