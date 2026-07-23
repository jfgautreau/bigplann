import { NextResponse, type NextRequest } from "next/server";
import { userAdminGuard } from "@/lib/permissions";
import { isRole } from "@/lib/roles";

// POST /api/users/role { user_id, role }
// Change le role d'un compte, enregistre des le choix dans la liste (plus de
// bouton « Enregistrer »). Route API et non server action : un <select> controle
// ne se serialise pas de facon fiable dans un <form action={serverAction}>.
//
// `userAdminGuard` verifie le droit « utilisateurs » ET l'anti-escalade, dans les
// deux sens : on ne promeut pas vers un role plus fort que le sien (`roleVise`),
// et on ne retrograde pas un compte plus fort que soi (`cibleUserId`). Aucun nom
// de role n'est ecrit ici : la comparaison sort de la matrice des droits.
// On interdit en plus de changer son propre role : sinon on peut se retirer ses
// droits et perdre l'acces a cet ecran.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { user_id?: string; role?: string } | null;
  const user_id = String(body?.user_id ?? "");
  const role = String(body?.role ?? "");
  if (!user_id || !isRole(role)) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const garde = await userAdminGuard({ cibleUserId: user_id, roleVise: role });
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });

  if (user_id === garde.profile.authId) {
    return NextResponse.json({ error: "Vous ne pouvez pas changer votre propre rôle." }, { status: 400 });
  }

  const { error } = await garde.supabase.from("app_user").update({ role }).eq("user_id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
