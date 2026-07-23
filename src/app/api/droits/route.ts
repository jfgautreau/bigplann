import { NextResponse, type NextRequest } from "next/server";
import { MODULE_KEYS, moduleWriteGuard, verifierChangementDroit, type Niveau } from "@/lib/permissions";
import { ROLES } from "@/lib/roles";

// POST /api/droits { role, module, niveau }
// Enregistre un droit (role x module) a la volee, pour le titulaire du droit
// « utilisateurs: write ».
//
// La regle de securite vit dans `verifierChangementDroit` (lib/permissions), pas
// ici : elle est ainsi testable sans passer par HTTP. Elle porte trois verrous,
// tous calcules sur la matrice, sans nommer aucun role :
//   1. anti-verrou            : on ne modifie pas les droits de son propre role ;
//   2. anti-retrogradation    : ni ceux d'un role qui detient plus que soi
//                               (c'est ce verrou qui rend l'admin intouchable) ;
//   3. anti-escalade          : on n'accorde pas un niveau qu'on n'a pas soi-meme.
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

  const verdict = await verifierChangementDroit(garde.profile.role, role, module, niveau);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  const { error } = await garde.supabase
    .from("role_permission")
    .upsert({ role, module, niveau }, { onConflict: "role,module" });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
