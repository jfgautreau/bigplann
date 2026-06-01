import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { roleLabel } from "@/lib/roles";
import AppHeader from "@/components/AppHeader";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <>
      <AppHeader role={profile.role} active="/" />
      <div className="container">
        <div className="card">
          <h1>Bienvenue, {profile.name || profile.email}</h1>
          <p className="muted">
            Connecte en tant que <strong>{roleLabel(profile.role)}</strong> (
            {profile.email}).
          </p>

          {profile.role === "admin" && (
            <p style={{ marginTop: 16 }}>
              <Link href="/admin/referentiel">Referentiel</Link>
              {"  ·  "}
              <Link href="/admin/equipes">Equipes</Link>
              {"  ·  "}
              <Link href="/personnel">Personnel</Link>
              {"  ·  "}
              <Link href="/admin/users">Utilisateurs</Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
