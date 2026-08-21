import { NextResponse, type NextRequest } from "next/server";
import { moduleWriteGuard } from "@/lib/permissions";
import { getCurrentSite } from "@/lib/current-site";
import { ROLES, ROLE_LABELS, slugifyRole } from "@/lib/roles";

// POST /api/roles { libelle }
// Crée un rôle personnalisé (table role_custom, migration 0042). Il naît SANS
// aucun droit (defaultsFor renvoie « none » pour tout code inconnu) et apparaît
// aussitôt dans la matrice des droits et les listes de rôles.
//
// Garde : droit « utilisateurs: write ». Créer un rôle sans droit n'est pas une
// escalade — les droits se règlent ensuite dans la matrice, elle-même protégée
// par l'anti-escalade (verifierChangementDroit).
export async function POST(req: NextRequest) {
  const garde = await moduleWriteGuard("utilisateurs");
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });
  const supabase = garde.supabase;

  const body = (await req.json().catch(() => null)) as { libelle?: string } | null;
  const libelle = String(body?.libelle ?? "").trim();
  if (!libelle) return NextResponse.json({ error: "Le nom du rôle est requis." }, { status: 400 });

  const code = slugifyRole(libelle);
  if (!code) return NextResponse.json({ error: "Nom de rôle invalide." }, { status: 400 });

  // Collision avec un rôle intégré (code OU libellé, insensible à la casse).
  const libLower = libelle.toLowerCase();
  if (
    (ROLES as readonly string[]).includes(code) ||
    ROLES.some((r) => ROLE_LABELS[r].toLowerCase() === libLower)
  ) {
    return NextResponse.json({ error: "Ce rôle existe déjà." }, { status: 409 });
  }

  const site = await getCurrentSite();
  // MULTI-SITE (0053) : role_custom.site_id NOT NULL. Le service_role
  // bypass la RLS, donc site_id doit être posé explicitement — sans quoi
  // le trigger fallback retomberait sur lebignon.
  const { error } = await supabase.from("role_custom").insert({ code, libelle, site_id: site.id });
  if (error) {
    // 23505 = violation d'unicité (code déjà présent, ou libellé via l'index).
    const dup = (error as { code?: string }).code === "23505";
    return NextResponse.json(
      { error: dup ? "Ce rôle existe déjà." : error.message },
      { status: dup ? 409 : 400 }
    );
  }
  return NextResponse.json({ ok: true, role: { code, libelle } });
}
