import { NextResponse, type NextRequest } from "next/server";
import { moduleWriteGuard } from "@/lib/permissions";

// POST /api/ordonnancement/semaine-type-ouverture
//   { quart_code, ligne_id, jour_semaine, value }
// Ouvre/ferme une ligne pour un (quart, jour de semaine) dans le gabarit.
// Ecriture : droit `ordonnancement` dans la matrice.
export async function POST(req: NextRequest) {
  // La matrice des droits decide, puis client admin : la RLS de ces tables
  // nomme des roles en dur (admin/ordo) et refuserait un titulaire du droit.
  const garde = await moduleWriteGuard("ordonnancement");
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });
  const supabase = garde.supabase;

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

  const { error } = await supabase
    .from("semaine_type_ouverture")
    .upsert({ profil_id, quart_code, ligne_id, jour_semaine, ouverte: value }, { onConflict: "profil_id,quart_code,ligne_id,jour_semaine" });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
