import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWritePlacementData } from "@/lib/permissions";

// POST /api/placement/reset-week { personne_ids: string[], jours: string[] }
// Vide UNIQUEMENT les affectations sur lignes (placements avec poste_id) des
// personnes pour ces jours. Les absences (motif, materialisees depuis la table
// absence) et le temps partiel ne sont PAS touches -> coherence avec l'ecran
// "Absences specifiques". La RLS (can_edit_personne) limite aux personnes
// autorisees (admin / chef).
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    personne_ids?: string[];
    jours?: string[];
  } | null;
  const ids = body?.personne_ids ?? [];
  const jours = body?.jours ?? [];
  if (!ids.length || !jours.length) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  const supabase = (await canWritePlacementData(profile.role)) ? getAdminClient() : await getServerClient();
  const { error } = await supabase
    .from("placement")
    .delete()
    .in("personne_id", ids)
    .in("jour", jours)
    .not("poste_id", "is", null); // ne supprime que les affectations sur poste
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
