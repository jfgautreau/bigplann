import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { getSemaineType, typeQuartActif } from "@/lib/semaine-type";

// POST /api/ordonnancement/reset-week { isos: string[] }
// Reinitialise la (ou les) journee(s) selon la semaine type :
//  - jour_quart.actif <- semaine type, pour chaque quart x jour ;
//  - ouverture_quart : on efface les exceptions de ces jours (lignes -> ouvert
//    par defaut).
// Ecriture admin/ordo (RLS).
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { isos?: string[] } | null;
  const isos = (body?.isos ?? []).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
  if (isos.length === 0) return NextResponse.json({ error: "Aucun jour" }, { status: 400 });

  const supabase = await getServerClient();

  const { data: quartsD } = await supabase
    .from("quart")
    .select("code")
    .returns<{ code: string }[]>();
  const quarts = (quartsD ?? []).map((q) => q.code);
  if (quarts.length === 0) return NextResponse.json({ error: "Aucun quart" }, { status: 400 });

  const type = await getSemaineType(supabase);

  const rows = isos.flatMap((iso) =>
    quarts.map((code) => ({ jour: iso, quart_code: code, actif: typeQuartActif(type, iso, code) }))
  );

  const { error: e1 } = await supabase
    .from("jour_quart")
    .upsert(rows, { onConflict: "jour,quart_code" });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 403 });

  // Efface les exceptions d'ouverture de lignes -> retour au defaut (ouvert).
  const { error: e2 } = await supabase.from("ouverture_quart").delete().in("jour", isos);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 403 });

  return NextResponse.json({ ok: true });
}
