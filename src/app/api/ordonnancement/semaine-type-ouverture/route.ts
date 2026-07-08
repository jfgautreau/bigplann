import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/ordonnancement/semaine-type-ouverture
//   { quart_code, ligne_id, jour_semaine, value }
// Ouvre/ferme une ligne pour un (quart, jour de semaine) dans le gabarit.
// Ecriture admin/ordo (RLS semaine_type_ouverture).
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    profil_id?: string;
    quart_code?: string;
    ligne_id?: string;
    jour_semaine?: number;
    value?: boolean;
  } | null;

  const profil_id = body?.profil_id;
  const quart_code = body?.quart_code;
  const ligne_id = body?.ligne_id;
  const jour_semaine = body?.jour_semaine;
  const value = !!body?.value;
  if (!profil_id || !quart_code || !ligne_id || jour_semaine === undefined || jour_semaine < 0 || jour_semaine > 6) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  const supabase = await getServerClient();
  const { error } = await supabase
    .from("semaine_type_ouverture")
    .upsert({ profil_id, quart_code, ligne_id, jour_semaine, ouverte: value }, { onConflict: "profil_id,quart_code,ligne_id,jour_semaine" });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
