import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/placement/cell { personne_id, jour, equipe_id, value }
//   value = ""  -> efface le placement
//   value = "X" -> jour non travaille
//   value = <poste_id> -> affecte au poste
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    personne_id?: string;
    jour?: string;
    equipe_id?: string | null;
    value?: string;
  } | null;

  const personne_id = body?.personne_id;
  const jour = body?.jour;
  const value = body?.value ?? "";
  if (!personne_id || !jour) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  const supabase = await getServerClient();

  if (value === "") {
    const { error } = await supabase
      .from("placement")
      .delete()
      .eq("personne_id", personne_id)
      .eq("jour", jour);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  const non_travaille = value === "X";
  const { error } = await supabase.from("placement").upsert(
    {
      personne_id,
      jour,
      equipe_id: body?.equipe_id ?? null,
      poste_id: non_travaille ? null : value,
      non_travaille,
      created_by: profile.authId,
    },
    { onConflict: "personne_id,jour" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
