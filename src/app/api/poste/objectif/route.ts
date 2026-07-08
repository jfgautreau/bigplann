import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWriteModule } from "@/lib/permissions";

// POST /api/poste/objectif { poste_id, objectif }
// Met a jour l'objectif de polyvalence d'un poste. Ecriture admin (RLS poste).
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    poste_id?: string;
    champ?: string;
    objectif?: number;
  } | null;
  const poste_id = body?.poste_id;
  const objectif = Math.max(0, Math.floor(Number(body?.objectif) || 0));
  const col = body?.champ === "cible" ? "objectif_cible" : "objectif_polyvalence";
  if (!poste_id) return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });

  // Objectifs = global : droit "matrice: write" (hors chef d'équipe).
  if (!(await canWriteModule(profile.role, "matrice"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("poste")
    .update({ [col]: objectif })
    .eq("id", poste_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
