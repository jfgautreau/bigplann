import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { isRole } from "@/lib/roles";

// POST /api/users/invite { email, role }
// Envoie une invitation Supabase. L'invite clique -> /auth/callback -> /reset
// pour definir son mot de passe. Le trigger handle_new_user cree la ligne app_user.
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

  // Verifie le role de l'appelant via app_user.
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
  } | null;
  const email = body?.email?.trim().toLowerCase();
  const name = body?.name?.trim() ?? "";
  const role = body?.role ?? "direction";

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (!isRole(role)) {
    return NextResponse.json({ error: "Role invalide" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const admin = getAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset`,
    data: { name },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Positionne le role + le nom (le trigger a insere la ligne par defaut).
  if (data.user) {
    await admin
      .from("app_user")
      .update({ role, name })
      .eq("user_id", data.user.id);
  }

  return NextResponse.json({ ok: true, user_id: data.user?.id });
}
