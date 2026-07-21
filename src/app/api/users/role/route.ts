import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { isRole } from "@/lib/roles";

// POST /api/users/role { user_id, role }
// Change le role d'un compte, enregistre des le choix dans la liste (plus de
// bouton « Enregistrer »). Route API et non server action : un <select> controle
// ne se serialise pas de facon fiable dans un <form action={serverAction}>.
//
// Ecriture via service_role APRES verification admin, comme la creation de compte.
// On interdit de changer son propre role : sinon un admin peut se retirer ses
// droits et perdre l'acces a cet ecran.
export async function POST(req: NextRequest) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: caller } = await supabase.from("app_user").select("role").eq("user_id", user.id).single<{ role: string }>();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Accès refusé (admin requis)" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { user_id?: string; role?: string } | null;
  const user_id = String(body?.user_id ?? "");
  const role = String(body?.role ?? "");
  if (!user_id || !isRole(role)) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  if (user_id === user.id) return NextResponse.json({ error: "Vous ne pouvez pas changer votre propre rôle." }, { status: 400 });

  const { error } = await getAdminClient().from("app_user").update({ role }).eq("user_id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
