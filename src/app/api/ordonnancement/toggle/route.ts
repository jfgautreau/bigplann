import { NextResponse, type NextRequest } from "next/server";
import { moduleWriteGuard } from "@/lib/permissions";

// POST /api/ordonnancement/toggle { type: "ligne" | "equipe", id, jour, value }
//   type ligne  -> ligne_ouverture(jour, ligne_id, ouverte=value)
//   type equipe -> jour_equipe(jour, equipe_id, actif=value)
export async function POST(req: NextRequest) {
  // La matrice des droits decide, puis client admin : la RLS de ces tables
  // nomme des roles en dur (admin/ordo) et refuserait un titulaire du droit.
  const garde = await moduleWriteGuard("ordonnancement");
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });
  const supabase = garde.supabase;

  const body = (await req.json().catch(() => null)) as {
    type?: string;
    id?: string;
    jour?: string;
    equipe_id?: string;
    value?: boolean;
  } | null;

  const { type, id, jour, equipe_id } = body ?? {};
  const value = !!body?.value;
  if (!type || !id || !jour) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  let error;
  if (type === "ligne") {
    if (!equipe_id) {
      return NextResponse.json({ error: "Equipe requise" }, { status: 400 });
    }
    ({ error } = await supabase
      .from("ligne_ouverture")
      .upsert(
        { jour, ligne_id: id, equipe_id, ouverte: value },
        { onConflict: "jour,ligne_id,equipe_id" }
      ));
  } else if (type === "equipe") {
    ({ error } = await supabase
      .from("jour_equipe")
      .upsert({ jour, equipe_id: id, actif: value }, { onConflict: "jour,equipe_id" }));
  } else {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
