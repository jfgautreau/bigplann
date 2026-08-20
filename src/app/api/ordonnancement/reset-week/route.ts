import { NextResponse, type NextRequest } from "next/server";
import { moduleWriteGuard } from "@/lib/permissions";
import { getSemaineType, getSemaineOuverture, typeQuartActif } from "@/lib/semaine-type";
import { dowMon } from "@/lib/week";

// POST /api/ordonnancement/reset-week { isos: string[] }
// Reinitialise la (ou les) journee(s) selon la semaine type :
//  - jour_quart.actif <- semaine type, pour chaque quart x jour ;
//  - ouverture_quart : on efface les exceptions de ces jours (lignes -> ouvert
//    par defaut).
// Ecriture : droit `ordonnancement` dans la matrice.
export async function POST(req: NextRequest) {
  // La matrice des droits decide, puis client admin : la RLS de ces tables
  // nomme des roles en dur (admin/ordo) et refuserait un titulaire du droit.
  const garde = await moduleWriteGuard("ordonnancement");
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });
  const supabase = garde.supabase;
  // Multi-site : le client admin (service_role) n'a pas d'auth.uid(), donc
  // le trigger set_site_id_from_context tombe en fallback sur le site
  // « Lebignon » code en dur (0043 ligne 602). On force le site du profil
  // pour que les ecritures partent dans le bon site — meme correctif que
  // creer_absence en 0044.
  const site_id = garde.profile.siteId;

  const body = (await req.json().catch(() => null)) as { isos?: string[]; profil_id?: string } | null;
  const isos = (body?.isos ?? []).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
  const profil_id = body?.profil_id || undefined;
  if (isos.length === 0) return NextResponse.json({ error: "Aucun jour" }, { status: 400 });

  // Blocage : (re)initialiser une semaine qui a deja des affectations reelles
  // (poste_id renseigne) ecraserait les fermetures/ouvertures decidees en
  // Placement, potentiellement laissant des personnes sur des lignes qui vont
  // se refermer. Les jours d'absence ne comptent pas.
  const { data: conf, error: eConf } = await supabase
    .from("placement")
    .select("jour")
    .in("jour", isos)
    .not("poste_id", "is", null)
    .is("motif_absence_id", null)
    .limit(1);
  if (eConf) return NextResponse.json({ error: eConf.message }, { status: 403 });
  if ((conf ?? []).length > 0) {
    return NextResponse.json(
      { error: "Des affectations existent déjà sur cette semaine. Videz-les dans Placement avant de la réinitialiser." },
      { status: 409 }
    );
  }

  const { data: quartsD } = await supabase
    .from("quart")
    .select("code")
    .returns<{ code: string }[]>();
  const quarts = (quartsD ?? []).map((q) => q.code);
  if (quarts.length === 0) return NextResponse.json({ error: "Aucun quart" }, { status: 400 });

  const [type, ouvType] = await Promise.all([getSemaineType(supabase, profil_id), getSemaineOuverture(supabase, profil_id)]);

  // 1) Quarts actifs <- gabarit.
  const rows = isos.flatMap((iso) =>
    quarts.map((code) => ({ jour: iso, quart_code: code, actif: typeQuartActif(type, iso, code), site_id }))
  );
  const { error: e1 } = await supabase
    .from("jour_quart")
    .upsert(rows, { onConflict: "jour,quart_code" });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 403 });

  // 2) Ouverture des lignes : on efface les exceptions de ces jours du site
  //    courant (le filtre site_id evite d'emporter les fermetures d'autres sites
  //    en cas d'usage service_role).
  const { error: e2 } = await supabase
    .from("ouverture_quart")
    .delete()
    .in("jour", isos)
    .eq("site_id", site_id);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 403 });

  // ...puis on re-pose les fermetures definies par le gabarit (absence = ouvert).
  const fermetures: { jour: string; quart_code: string; ligne_id: string; ouverte: boolean; site_id: string }[] = [];
  for (const iso of isos) {
    const dow = dowMon(iso);
    for (const [key, ouverte] of Object.entries(ouvType)) {
      if (ouverte) continue; // ouvert = defaut, rien a ecrire
      const [quart_code, ligne_id, j] = key.split(":");
      if (Number(j) === dow) fermetures.push({ jour: iso, quart_code, ligne_id, ouverte: false, site_id });
    }
  }
  if (fermetures.length > 0) {
    const { error: e3 } = await supabase
      .from("ouverture_quart")
      .upsert(fermetures, { onConflict: "jour,ligne_id,quart_code" });
    if (e3) return NextResponse.json({ error: e3.message }, { status: 403 });
  }

  // Instantané applique (pour la mise a jour immediate cote client, selon le profil).
  const jq: Record<string, boolean> = {};
  for (const r of rows) jq[`${r.quart_code}:${r.jour}`] = r.actif;
  const fermeturesKeys = fermetures.map((f) => `${f.quart_code}:${f.ligne_id}:${f.jour}`);
  return NextResponse.json({ ok: true, jq, fermetures: fermeturesKeys });
}
