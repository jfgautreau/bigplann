import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// GET /api/personnel/[id]/export
// Export RGPD des donnees d'une personne (JSON). Admin uniquement.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

  const { id } = await params;
  const supabase = await getServerClient();

  const [personne, matrice, competences, placements] = await Promise.all([
    supabase.from("personne").select("*").eq("id", id).single(),
    supabase.from("matrice").select("*").eq("personne_id", id),
    supabase.from("personne_competence").select("*").eq("personne_id", id),
    supabase.from("placement").select("*").eq("personne_id", id),
  ]);

  const payload = {
    export_le: new Date().toISOString(),
    personne: personne.data,
    matrice: matrice.data ?? [],
    competences: competences.data ?? [],
    placements: placements.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="personne-${id}.json"`,
    },
  });
}
