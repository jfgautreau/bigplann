import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { canWriteModule } from "@/lib/permissions";

// POST /api/users/active { user_id, active }
// Active / desactive un compte : met a jour app_user.is_active ET banni (ou leve le
// ban) cote Supabase Auth, car is_active seul ne bloque pas la connexion.
// Reserve aux admins ; on ne peut pas se desactiver soi-meme (evite l'auto-verrou).
const BAN_LONG = "876000h"; // ~100 ans

export async function POST(req: NextRequest) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: caller } = await supabase.from("app_user").select("role").eq("user_id", user.id).single<{ role: string }>();
  // La matrice decide : admin (qui a tout par defaut) ou droit « utilisateurs: write ».
  if (caller?.role !== "admin" && !(await canWriteModule(caller?.role ?? "", "utilisateurs"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { user_id?: string; active?: boolean } | null;
  const user_id = String(body?.user_id ?? "");
  const active = body?.active === true;
  if (!user_id) return NextResponse.json({ error: "user_id manquant" }, { status: 400 });
  if (user_id === user.id && !active) return NextResponse.json({ error: "Impossible de se désactiver soi-même." }, { status: 400 });

  const admin = getAdminClient();
  const { error: dbErr } = await admin.from("app_user").update({ is_active: active }).eq("user_id", user_id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 });

  const { error: authErr } = await admin.auth.admin.updateUserById(user_id, { ban_duration: active ? "none" : BAN_LONG });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
