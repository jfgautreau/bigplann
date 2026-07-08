import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { getPermissions, canWrite } from "@/lib/permissions";

// POST /api/matrice/cell { personne_id, poste_id, niveau_actuel, niveau_cible }
// Upsert d'une cellule de matrice. La RLS (can_edit_personne) autorise admin
// ou chef de l'equipe ; un refus renvoie 403.
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    personne_id?: string;
    poste_id?: string;
    niveau_actuel?: number;
    niveau_cible?: number;
  } | null;

  const personne_id = body?.personne_id;
  const poste_id = body?.poste_id;
  // -1 = restriction (medicale / physique) ; 0..4 = echelle de competence.
  const clamp = (n: unknown) => Math.max(-1, Math.min(4, Number(n) || 0));
  const niveau_actuel = clamp(body?.niveau_actuel);
  const niveau_cible = clamp(body?.niveau_cible);

  if (!personne_id || !poste_id) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  // Droit d'écriture "matrice" -> client admin (contourne la RLS admin/chef).
  // Sinon RLS : admin ou chef de l'équipe de la personne.
  const perms = await getPermissions(profile.role);
  const supabase = canWrite(perms, "matrice") ? getAdminClient() : await getServerClient();
  const { error } = await supabase.from("matrice").upsert(
    {
      personne_id,
      poste_id,
      niveau_actuel,
      niveau_cible,
      auteur_app_user_id: profile.authId,
      date_maj: new Date().toISOString(),
    },
    { onConflict: "personne_id,poste_id" }
  );

  if (error) {
    // RLS / permission ou autre
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
