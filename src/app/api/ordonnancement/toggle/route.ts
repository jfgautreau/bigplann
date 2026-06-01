import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/ordonnancement/toggle { type: "ligne" | "equipe", id, jour, value }
//   type ligne  -> ligne_ouverture(jour, ligne_id, ouverte=value)
//   type equipe -> jour_equipe(jour, equipe_id, actif=value)
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    type?: string;
    id?: string;
    jour?: string;
    value?: boolean;
  } | null;

  const { type, id, jour } = body ?? {};
  const value = !!body?.value;
  if (!type || !id || !jour) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  const supabase = await getServerClient();
  let error;
  if (type === "ligne") {
    ({ error } = await supabase
      .from("ligne_ouverture")
      .upsert({ jour, ligne_id: id, ouverte: value }, { onConflict: "jour,ligne_id" }));
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
