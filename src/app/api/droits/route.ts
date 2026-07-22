import { NextResponse, type NextRequest } from "next/server";
import { MODULE_KEYS, moduleWriteGuard, type Niveau } from "@/lib/permissions";
import { ROLES } from "@/lib/roles";

// POST /api/droits { role, module, niveau }
// Enregistre un droit (role x module) a la volee. Admin uniquement.
// L'admin garde toujours "write" (non modifiable).
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
  if (role === "admin") return NextResponse.json({ error: "L'admin garde tous les droits." }, { status: 400 });
  if (!ROLES.includes(role as (typeof ROLES)[number]) || !MODULE_KEYS.includes(module) || !VALID.includes(niveau)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const { error } = await garde.supabase
    .from("role_permission")
    .upsert({ role, module, niveau }, { onConflict: "role,module" });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
