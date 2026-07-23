import { NextResponse, type NextRequest } from "next/server";
import { userAdminGuard } from "@/lib/permissions";
import { isRole } from "@/lib/roles";
import { genererLienMotDePasse, motDePasseAleatoire } from "@/lib/password-link";

// POST /api/users/create { email, name, role }
// Cree un compte confirme puis renvoie un LIEN que l'admin transmet : c'est
// l'utilisateur qui choisit son mot de passe. Le compte est ouvert avec un mot de
// passe aleatoire que personne ne connait — il ne sert qu'a satisfaire Supabase.
// Aucun email n'est envoye (cf. src/lib/password-link.ts).
//
// Securite : droit « utilisateurs: write » (via la matrice) ET anti-escalade —
// on ne cree pas un compte plus puissant que soi, puisqu'on repart avec son lien
// de connexion.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    name?: string;
    role?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase();
  const name = body?.name?.trim() ?? "";
  const role = String(body?.role ?? "");

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (!isRole(role)) {
    return NextResponse.json({ error: "Role invalide" }, { status: 400 });
  }

  const garde = await userAdminGuard({ roleVise: role });
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });
  const admin = garde.supabase;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasseAleatoire(),
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Positionne role + nom et ACTIVE le compte : le trigger `handle_new_user` cree
  // desormais la ligne inactive (fermeture par defaut, cf. migration 0036).
  if (data.user) {
    const { error: majErr } = await admin
      .from("app_user")
      .update({ role, name, is_active: true })
      .eq("user_id", data.user.id);
    if (majErr) {
      return NextResponse.json({ error: `Compte cree mais non active : ${majErr.message}` }, { status: 500 });
    }
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
