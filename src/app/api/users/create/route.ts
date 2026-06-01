import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { isRole } from "@/lib/roles";
import { validatePasswordPolicy } from "@/lib/password";

// POST /api/users/create { email, name, role, password }
// Cree un utilisateur DIRECTEMENT avec un mot de passe (compte confirme,
// sans email d'invitation). Pratique quand le quota SMTP Supabase est limite.
//
// Securite : seul un admin authentifie peut appeler cette route.
export async function POST(req: NextRequest) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const { data: caller, error: callerErr } = await supabase
    .from("app_user")
    .select("role")
    .eq("user_id", user.id)
    .single<{ role: string }>();
  if (callerErr || caller?.role !== "admin") {
    return NextResponse.json(
      { error: "Acces refuse (admin requis)" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    name?: string;
    role?: string;
    password?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase();
  const name = body?.name?.trim() ?? "";
  const role = body?.role ?? "direction";
  const password = body?.password ?? "";

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (!isRole(role)) {
    return NextResponse.json({ error: "Role invalide" }, { status: 400 });
  }
  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Positionne role + nom (le trigger a insere la ligne par defaut 'direction').
  if (data.user) {
    await admin
      .from("app_user")
      .update({ role, name })
      .eq("user_id", data.user.id);
  }

  return NextResponse.json({ ok: true, user_id: data.user?.id });
}
