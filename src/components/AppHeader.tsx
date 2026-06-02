import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import { isoDate, addDays } from "@/lib/week";
import { MODULES, getPermissions, canRead, canWrite } from "@/lib/permissions";

// En-tete commun : navigation pilotee par la matrice des droits, cloche
// d'alerte habilitations, deconnexion.
export default async function AppHeader({
  role,
  active,
}: {
  role: string;
  active?: string;
}) {
  const perms = await getPermissions(role);
  const isAdmin = role === "admin";

  // Compteur d'alertes habilitations (<= 90 jours)
  let alertCount = 0;
  try {
    const supabase = await getServerClient();
    const limit = isoDate(addDays(new Date(), 90));
    const { count } = await supabase
      .from("personne_competence")
      .select("*", { count: "exact", head: true })
      .not("date_expiration", "is", null)
      .lte("date_expiration", limit);
    alertCount = count ?? 0;
  } catch {
    alertCount = 0;
  }

  // Un module operationnel apparait des la lecture ; un module d'admin
  // apparait uniquement avec le droit de modification.
  const links = MODULES.filter((m) =>
    m.admin ? canWrite(perms, m.key) : canRead(perms, m.key)
  );

  return (
    <header className="appheader">
      <nav className="appnav">
        <Link href="/planning" className="brand" style={{ textDecoration: "none", color: "var(--primary)" }}>
          BigPlann&apos;
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={active === l.href ? "navlink active" : "navlink"}
          >
            {l.label}
          </Link>
        ))}
        {isAdmin && (
          <Link href="/admin/droits" className={active === "/admin/droits" ? "navlink active" : "navlink"}>
            Droits
          </Link>
        )}
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Link href="/habilitations" title="Habilitations a recycler" style={{ position: "relative", textDecoration: "none", fontSize: 18 }}>
          &#128276;
          {alertCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -10,
                background: "var(--danger)",
                color: "#fff",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                padding: "0 5px",
              }}
            >
              {alertCount}
            </span>
          )}
        </Link>
        <form action="/logout" method="post">
          <button type="submit" className="logout">
            Se deconnecter
          </button>
        </form>
      </div>
    </header>
  );
}
