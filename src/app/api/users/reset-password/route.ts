import { NextResponse, type NextRequest } from "next/server";
import { userAdminGuard } from "@/lib/permissions";
import { genererLienMotDePasse } from "@/lib/password-link";

// POST /api/users/reset-password { user_id }
// Genere un LIEN de reinitialisation que l'admin transmet a l'utilisateur, lequel
// choisit lui-meme son mot de passe. L'admin ne saisit plus (et ne connait donc
// plus) le mot de passe de personne.
//
// ⚠️ Ce lien ouvre la session du compte vise : c'est la brique centrale de
// l'escalade de privileges. `userAdminGuard` refuse donc de le produire pour un
// compte dont les droits depassent ceux de l'appelant.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { user_id?: string } | null;
  const user_id = String(body?.user_id ?? "");
  if (!user_id) return NextResponse.json({ error: "user_id manquant" }, { status: 400 });

  const garde = await userAdminGuard({ cibleUserId: user_id });
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });

  // L'email vient de la base, jamais du client : un appel forge ne doit pas
  // pouvoir fabriquer un lien de recuperation vers une adresse arbitraire.
  const { data: cible } = await garde.supabase
    .from("app_user")
    .select("email")
    .eq("user_id", user_id)
    .single<{ email: string }>();
  if (!cible?.email) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  try {
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    const lien = await genererLienMotDePasse(cible.email, origin);
    return NextResponse.json({ ok: true, lien, email: cible.email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Échec." }, { status: 400 });
  }
}
