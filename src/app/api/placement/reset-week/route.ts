import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/placement/reset-week { personne_ids: string[], jours: string[] }
// Supprime tous les placements (tous quarts) des personnes pour ces jours.
// La RLS (can_edit_personne) limite aux personnes autorisees (admin / chef).
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

  const supabase = await getServerClient();
  const { error } = await supabase
    .from("placement")
    .delete()
    .in("personne_id", ids)
    .in("jour", jours);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
