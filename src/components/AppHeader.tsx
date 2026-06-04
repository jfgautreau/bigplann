import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import { isoDate, addDays } from "@/lib/week";
import { MODULES, getPermissions, canRead, canWrite } from "@/lib/permissions";
import SettingsMenu from "@/components/SettingsMenu";

const MAIN_ORDER = ["personnel", "matrice", "ordonnancement", "planning", "bilans"];

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

  const visible = (m: (typeof MODULES)[number]) =>
    m.admin ? canWrite(perms, m.key) : canRead(perms, m.key);

  // Navigation principale (ordre impose)
  const mainLinks = MAIN_ORDER.map((k) => MODULES.find((m) => m.key === k))
    .filter((m): m is (typeof MODULES)[number] => !!m)
    .filter(visible);

  // Reste (parametrage) regroupe sous l'engrenage. Habilitations = la cloche.
  const configLinks = MODULES.filter(
    (m) => !MAIN_ORDER.includes(m.key) && m.key !== "habilitations" && visible(m)
  ).map((m) => ({ href: m.href, label: m.label }));
  if (isAdmin) configLinks.push({ href: "/admin/droits", label: "Droits" });

  return (
    <header className="appheader">
      <nav className="appnav">
        <Link href="/planning" className="brand" style={{ textDecoration: "none" }}>
          BigPlann&apos;
        </Link>
        {mainLinks.map((l) => (
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
        <SettingsMenu links={configLinks} active={active} />
        <Link href="/habilitations" title="Habilitations à recycler" style={{ position: "relative", textDecoration: "none", fontSize: 18, color: "#fff" }}>
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
            Se déconnecter
          </button>
        </form>
      </div>
    </header>
  );
}
