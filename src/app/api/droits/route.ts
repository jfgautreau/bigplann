import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { MODULE_KEYS, type Niveau } from "@/lib/permissions";
import { ROLES } from "@/lib/roles";

// POST /api/droits { role, module, niveau }
// Enregistre un droit (role x module) a la volee. Admin uniquement.
// L'admin garde toujours "write" (non modifiable).
const VALID: Niveau[] = ["none", "read", "write"];

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { role?: string; module?: string; niveau?: string } | null;
  const role = String(body?.role ?? "");
  const module = String(body?.module ?? "");
  const niveau = String(body?.niveau ?? "") as Niveau;
  if (role === "admin") return NextResponse.json({ error: "L'admin garde tous les droits." }, { status: 400 });
  if (!ROLES.includes(role as (typeof ROLES)[number]) || !MODULE_KEYS.includes(module) || !VALID.includes(niveau)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const supabase = await getServerClient();
  const { error } = await supabase.from("role_permission").upsert({ role, module, niveau }, { onConflict: "role,module" });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
