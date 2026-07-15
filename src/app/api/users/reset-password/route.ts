import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { validatePasswordPolicy } from "@/lib/password";

// POST /api/users/reset-password { user_id, password }
// Reinitialise le mot de passe d'un compte : l'admin saisit la nouvelle valeur,
// appliquee directement (sans email). Reserve aux admins authentifies.
export async function POST(req: NextRequest) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: caller } = await supabase.from("app_user").select("role").eq("user_id", user.id).single<{ role: string }>();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Accès refusé (admin requis)" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { user_id?: string; password?: string } | null;
  const user_id = String(body?.user_id ?? "");
  const password = String(body?.password ?? "");
  if (!user_id) return NextResponse.json({ error: "user_id manquant" }, { status: 400 });
  const policyError = validatePasswordPolicy(password);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  const admin = getAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user_id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
