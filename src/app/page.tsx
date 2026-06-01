import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  RESP_PROD: "Responsable production",
  RESP_PLANNING: "Responsable planning",
  CHEF_EQUIPE: "Chef d'equipe",
  ORDONNANCEMENT: "Ordonnancement",
  RH: "RH",
  DIRECTION: "Direction / Reporting",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Le middleware garantit une session, mais on reste defensif.
  if (!user) {
    return null;
  }

  return (
    <div className="container">
      <div className="topbar">
        <strong>Planning Usine</strong>
        <form action="/logout" method="post">
          <button type="submit">Se deconnecter</button>
        </form>
      </div>

      <div className="card">
        <h1>Bienvenue, {user.name}</h1>
        <p className="muted">
          Connecte en tant que <strong>{ROLE_LABELS[user.role] ?? user.role}</strong>{" "}
          ({user.email}).
        </p>

        {user.role === "ADMIN" && (
          <p style={{ marginTop: 16 }}>
            <Link href="/admin/users">Gestion des utilisateurs &rarr;</Link>
          </p>
        )}

        <p className="muted" style={{ marginTop: 24 }}>
          Test simplifie de la stack (Lot 1). Les modules metier seront ajoutes
          apres validation.
        </p>
      </div>
    </div>
  );
}
