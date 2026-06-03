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
    quart?: string | null;
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

  let poste_id: string | null = null;
  let motif_absence_id: string | null = null;
  let non_travaille = false;
  if (value === "X") non_travaille = true;
  else if (value.startsWith("m:")) motif_absence_id = value.slice(2);
  else poste_id = value;

  // Le quart ne s'applique qu'a un placement sur poste (une absence/NT vaut
  // pour toute la journee, tous quarts).
  const quart_code = poste_id ? (body?.quart ?? null) : null;

  // Une personne placee sur un poste un quart ne peut pas etre placee sur un
  // poste d'un autre quart le meme jour (legacy quart null = matin).
  if (poste_id) {
    const { data: existing } = await supabase
      .from("placement")
      .select("poste_id, quart_code")
      .eq("personne_id", personne_id)
      .eq("jour", jour)
      .maybeSingle<{ poste_id: string | null; quart_code: string | null }>();
    if (existing?.poste_id) {
      const exQ = existing.quart_code ?? "matin";
      const newQ = quart_code ?? "matin";
      if (exQ !== newQ) {
        return NextResponse.json(
          { error: "Personne deja placee sur un autre quart ce jour-la." },
          { status: 409 }
        );
      }
    }
  }

  const { error } = await supabase.from("placement").upsert(
    {
      personne_id,
      jour,
      equipe_id: body?.equipe_id ?? null,
      poste_id,
      motif_absence_id,
      non_travaille,
      quart_code,
      created_by: profile.authId,
    },
    { onConflict: "personne_id,jour" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
