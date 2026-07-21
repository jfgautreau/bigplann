import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { canWriteModule } from "@/lib/permissions";
import { isRole } from "@/lib/roles";
import { genererLienMotDePasse, motDePasseAleatoire } from "@/lib/password-link";

// POST /api/users/create { email, name, role }
// Cree un compte confirme puis renvoie un LIEN que l'admin transmet : c'est
// l'utilisateur qui choisit son mot de passe. Le compte est ouvert avec un mot de
// passe aleatoire que personne ne connait — il ne sert qu'a satisfaire Supabase.
// Aucun email n'est envoye (cf. src/lib/password-link.ts).
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
  // La matrice decide : admin (qui a tout par defaut) ou droit « utilisateurs: write ».
  if (callerErr || (caller?.role !== "admin" && !(await canWriteModule(caller?.role ?? "", "utilisateurs")))) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
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

  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasseAleatoire(),
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

  // Le compte existe : sans ce lien, l'utilisateur n'a aucun moyen d'entrer.
  // Si la generation echoue, on le dit clairement plutot que d'annoncer un succes
  // trompeur — l'admin pourra relancer via « Lien de mot de passe » sur la ligne.
  try {
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    const lien = await genererLienMotDePasse(email, origin);
    return NextResponse.json({ ok: true, user_id: data.user?.id, lien, email });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      user_id: data.user?.id,
      email,
      lienErreur: e instanceof Error ? e.message : "Lien non généré.",
    });
  }
}
