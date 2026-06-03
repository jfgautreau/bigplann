import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/ordonnancement/quart
//   { type: "quart", quart_code, jour, value }            -> jour_quart.actif
//   { type: "ligne", quart_code, ligne_id, jour, value }  -> ouverture_quart.ouverte
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    type?: string;
    quart_code?: string;
    ligne_id?: string;
    jour?: string;
    value?: boolean;
  } | null;

  const { type, quart_code, ligne_id, jour } = body ?? {};
  const value = !!body?.value;
  if (!type || !quart_code || !jour) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  const supabase = await getServerClient();
  let error;
  if (type === "quart") {
    ({ error } = await supabase
      .from("jour_quart")
      .upsert({ jour, quart_code, actif: value }, { onConflict: "jour,quart_code" }));
  } else if (type === "ligne") {
    if (!ligne_id) return NextResponse.json({ error: "Ligne requise" }, { status: 400 });
    ({ error } = await supabase
      .from("ouverture_quart")
      .upsert({ jour, ligne_id, quart_code, ouverte: value }, { onConflict: "jour,ligne_id,quart_code" }));
  } else {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
