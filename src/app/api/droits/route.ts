import { NextResponse, type NextRequest } from "next/server";
import { MODULE_KEYS, moduleWriteGuard, getPermissions, RANG, type Niveau } from "@/lib/permissions";
import { ROLES } from "@/lib/roles";

// POST /api/droits { role, module, niveau }
// Enregistre un droit (role x module) a la volee, pour le titulaire du droit
// « utilisateurs: write ».
//
// Deux garde-fous, tous deux formules SANS nommer de role en dur :
//  1. anti-verrou : on ne modifie pas les droits de SON PROPRE role. Sinon un
//     admin peut retirer « utilisateurs » a son propre role et plus personne ne
//     peut rouvrir l'ecran. C'est le pendant de « on ne change pas son propre
//     role » dans /api/users/role.
//  2. anti-escalade : on n'accorde pas, sur un module, un niveau superieur a
//     celui qu'on detient soi-meme. Sans cela, un titulaire du droit
//     « utilisateurs » se fabrique un role sur mesure puis s'y fait basculer.
const VALID: Niveau[] = ["none", "read", "write"];

export async function POST(req: NextRequest) {
  // La matrice decide, y compris pour l'ecran qui l'edite — et le client admin
  // qui va avec : role_permission est sous RLS `is_admin()`, un titulaire du droit
  // « utilisateurs » qui n'est pas admin se faisait refuser sans explication.
  const garde = await moduleWriteGuard("utilisateurs");
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });

  const body = (await req.json().catch(() => null)) as { role?: string; module?: string; niveau?: string } | null;
  const role = String(body?.role ?? "");
  const module = String(body?.module ?? "");
  const niveau = String(body?.niveau ?? "") as Niveau;
  if (!ROLES.includes(role as (typeof ROLES)[number]) || !MODULE_KEYS.includes(module) || !VALID.includes(niveau)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  if (role === garde.profile.role) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas modifier les droits de votre propre rôle." },
      { status: 400 }
    );
  }

  const miens = await getPermissions(garde.profile.role);
  if (RANG[niveau] > RANG[miens[module] ?? "none"]) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas accorder un droit que vous n'avez pas vous-même." },
      { status: 403 }
    );
  }

  const { error } = await garde.supabase
    .from("role_permission")
    .upsert({ role, module, niveau }, { onConflict: "role,module" });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
