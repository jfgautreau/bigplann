import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { isoDate, addDays } from "@/lib/week";
import { MODULES, getPermissions, canRead, canWrite } from "@/lib/permissions";
import SettingsMenu from "@/components/SettingsMenu";
import UserMenu from "@/components/UserMenu";
import { NavIcon, NAV_COLOR } from "@/components/NavIcons";

const MAIN_ORDER = ["referentiel", "personnel", "matrice", "habilitations", "ordonnancement", "planning", "placement", "bilans"];

// Palette des pastilles (icone blanche dessus) : source unique dans NavIcons.
const NAV_TILE = NAV_COLOR;

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
  const profile = await getCurrentProfile();

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
    // Placement est un ecran de SAISIE : sa page exige "write" (cf. requireModule).
    // Sans ecriture il n'y a rien a y faire -> on n'affiche pas l'entree, sinon le
    // menu menerait a une redirection.
    m.key === "placement" ? canWrite(perms, m.key) : m.admin ? canWrite(perms, m.key) : canRead(perms, m.key);

  // Navigation principale (ordre impose)
  const mainLinks = MAIN_ORDER.map((k) => MODULES.find((m) => m.key === k))
    .filter((m): m is (typeof MODULES)[number] => !!m)
    .filter(visible);

  // Reste (parametrage) regroupe sous l'engrenage. Habilitations est desormais
  // une tuile du menu principal (plus seulement la cloche d'alerte).
  // La page Equipes heberge desormais la rotation des quarts : son entree est aussi
  // visible pour un droit "ordonnancement" (les droits d'acces sont dans Utilisateurs).
  const visibleConfig = (m: (typeof MODULES)[number]) =>
    m.key === "equipes" ? canWrite(perms, "equipes") || canWrite(perms, "ordonnancement") : visible(m);
  const configLinks = MODULES.filter(
    (m) => !MAIN_ORDER.includes(m.key) && visibleConfig(m)
  ).map((m) => ({ href: m.href, label: m.label }));

  return (
    <header className="appheader">
      <nav className="appnav">
        <Link href="/" className="brand" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 9 }}>
          <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true" style={{ display: "block" }}>
            <defs>
              <linearGradient id="bpLogo" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#4338ca" />
                <stop offset="0.55" stopColor="#6d28d9" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#bpLogo)" />
            <text x="30" y="47" textAnchor="middle" fill="#fff" fontFamily="Arial, Helvetica, sans-serif" fontSize="40" fontWeight="900">B</text>
            <circle cx="47" cy="20" r="3.4" fill="#ddd6fe" />
          </svg>
          BigPlann&apos;
        </Link>
        {mainLinks.map((l) => {
          const tile = NAV_TILE[l.key];
          return (
            <Link
              key={l.href}
              href={l.href}
              className={active === l.href ? "navlink active" : "navlink"}
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              {tile && (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    background: tile,
                    flexShrink: 0,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
                  }}
                >
                  <NavIcon name={l.key} />
                </span>
              )}
              {l.label}
            </Link>
          );
        })}
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
        <UserMenu name={profile?.name ?? ""} email={profile?.email ?? ""} />
      </div>
    </header>
  );
}
