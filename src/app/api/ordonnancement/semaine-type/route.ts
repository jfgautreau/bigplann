import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/ordonnancement/semaine-type { quart_code, jour_semaine, value }
// Active/desactive un quart pour un jour de la semaine type (gabarit).
// Ecriture admin/ordo (RLS semaine_type_quart).
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    quart_code?: string;
    jour_semaine?: number;
    value?: boolean;
  } | null;

  const quart_code = body?.quart_code;
  const jour_semaine = body?.jour_semaine;
  const value = !!body?.value;
  if (!quart_code || jour_semaine === undefined || jour_semaine < 0 || jour_semaine > 6) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  const supabase = await getServerClient();
  const { error } = await supabase
    .from("semaine_type_quart")
    .upsert({ quart_code, jour_semaine, actif: value }, { onConflict: "quart_code,jour_semaine" });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
