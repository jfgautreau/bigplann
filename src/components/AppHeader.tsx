import Link from "next/link";

// En-tete commun aux pages authentifiees : navigation selon le role + deconnexion.
export default function AppHeader({
  role,
  active,
}: {
  role: string;
  active?: string;
}) {
  const isAdmin = role === "admin";
  const canAudit = role === "admin" || role === "codir";
  const canOrdo = role === "admin" || role === "ordo";

  const links: { href: string; label: string; show: boolean }[] = [
    { href: "/", label: "Accueil", show: true },
    { href: "/personnel", label: "Personnel", show: true },
    { href: "/matrice", label: "Matrice", show: true },
    { href: "/planning", label: "Planning", show: true },
    { href: "/ordonnancement", label: "Ordonnancement", show: canOrdo },
    { href: "/admin/referentiel", label: "Referentiel", show: isAdmin },
    { href: "/admin/equipes", label: "Equipes", show: isAdmin },
    { href: "/admin/competences", label: "Competences", show: isAdmin },
    { href: "/admin/users", label: "Utilisateurs", show: isAdmin },
    { href: "/journal", label: "Journal", show: canAudit },
  ];

  return (
    <header className="appheader">
      <nav className="appnav">
        <strong className="brand">Planning Usine</strong>
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
      <form action="/logout" method="post">
        <button type="submit" className="logout">
          Se deconnecter
        </button>
      </form>
    </header>
  );
}
