import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { getSemaineType, getSemaineOuverture, typeQuartActif } from "@/lib/semaine-type";
import { dowMon } from "@/lib/week";

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

  const [type, ouvType] = await Promise.all([getSemaineType(supabase), getSemaineOuverture(supabase)]);

  // 1) Quarts actifs <- gabarit.
  const rows = isos.flatMap((iso) =>
    quarts.map((code) => ({ jour: iso, quart_code: code, actif: typeQuartActif(type, iso, code) }))
  );
  const { error: e1 } = await supabase
    .from("jour_quart")
    .upsert(rows, { onConflict: "jour,quart_code" });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 403 });

  // 2) Ouverture des lignes : on efface les exceptions de ces jours...
  const { error: e2 } = await supabase.from("ouverture_quart").delete().in("jour", isos);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 403 });

  // ...puis on re-pose les fermetures definies par le gabarit (absence = ouvert).
  const fermetures: { jour: string; quart_code: string; ligne_id: string; ouverte: boolean }[] = [];
  for (const iso of isos) {
    const dow = dowMon(iso);
    for (const [key, ouverte] of Object.entries(ouvType)) {
      if (ouverte) continue; // ouvert = defaut, rien a ecrire
      const [quart_code, ligne_id, j] = key.split(":");
      if (Number(j) === dow) fermetures.push({ jour: iso, quart_code, ligne_id, ouverte: false });
    }
  }
  if (fermetures.length > 0) {
    const { error: e3 } = await supabase
      .from("ouverture_quart")
      .upsert(fermetures, { onConflict: "jour,ligne_id,quart_code" });
    if (e3) return NextResponse.json({ error: e3.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
