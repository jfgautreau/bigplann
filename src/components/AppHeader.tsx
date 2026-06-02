import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import { isoDate, addDays } from "@/lib/week";

// En-tete commun aux pages authentifiees : navigation selon le role,
// cloche d'alerte habilitations, deconnexion.
export default async function AppHeader({
  role,
  active,
}: {
  role: string;
  active?: string;
}) {
  const isAdmin = role === "admin";
  const canAudit = role === "admin" || role === "codir";
  const canOrdo = role === "admin" || role === "ordo";

  // Nombre d'habilitations en alerte (expiration <= 90 jours, ou expirees)
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

  const links: { href: string; label: string; show: boolean }[] = [
    { href: "/personnel", label: "Personnel", show: true },
    { href: "/matrice", label: "Matrice", show: true },
    { href: "/habilitations", label: "Habilitations", show: true },
    { href: "/ordonnancement", label: "Ordonnancement", show: canOrdo },
    { href: "/bilans", label: "Bilans", show: true },
    { href: "/affichage", label: "Affichage", show: isAdmin },
    { href: "/admin/referentiel", label: "Referentiel", show: isAdmin },
    { href: "/admin/equipes", label: "Equipes", show: isAdmin },
    { href: "/admin/competences", label: "Competences", show: isAdmin },
    { href: "/admin/motifs", label: "Motifs", show: isAdmin },
    { href: "/admin/users", label: "Utilisateurs", show: isAdmin },
    { href: "/admin/rgpd", label: "RGPD", show: isAdmin },
    { href: "/journal", label: "Journal", show: canAudit },
  ];

  return (
    <header className="appheader">
      <nav className="appnav">
        <Link href="/planning" className="brand" style={{ textDecoration: "none", color: "var(--primary)" }}>
          BigPlann&apos;
        </Link>
        {links
          .filter((l) => l.show)
          .map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={active === l.href ? "navlink active" : "navlink"}
            >
              {l.label}
            </Link>
          ))}
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
