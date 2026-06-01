import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import UserForm from "./UserForm";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  RESP_PROD: "Responsable production",
  RESP_PLANNING: "Responsable planning",
  CHEF_EQUIPE: "Chef d'equipe",
  ORDONNANCEMENT: "Ordonnancement",
  RH: "RH",
  DIRECTION: "Direction / Reporting",
};

export default async function AdminUsersPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.role !== "ADMIN") redirect("/");

  const users = await prisma.appUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lockedAt: true,
    },
  });

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
        <h1>Creer un utilisateur</h1>
        <UserForm />
      </div>

      <div className="card">
        <h1>Utilisateurs ({users.length})</h1>
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
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                <td>
                  {u.lockedAt
                    ? "Verrouille"
                    : u.isActive
                      ? "Actif"
                      : "Desactive"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
