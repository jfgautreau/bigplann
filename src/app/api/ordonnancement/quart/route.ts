import { NextResponse, type NextRequest } from "next/server";
import { moduleWriteGuard } from "@/lib/permissions";

// POST /api/ordonnancement/quart
//   { type: "quart", quart_code, jour, value }            -> jour_quart.actif
//   { type: "ligne", quart_code, ligne_id, jour, value }  -> ouverture_quart.ouverte
export async function POST(req: NextRequest) {
  // La matrice des droits decide, puis client admin : la RLS de ces tables
  // nomme des roles en dur (admin/ordo) et refuserait un titulaire du droit.
  const garde = await moduleWriteGuard("ordonnancement");
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });
  const supabase = garde.supabase;

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

  let error;
  if (type === "quart") {
    // Blocage : desactiver un quart qui a deja des affectations reelles
    // (poste_id renseigne) laisserait ces personnes en dehors du plan sans
    // avertissement. Les absences ne comptent pas. Les autres quarts non plus
    // (une personne sur le matin ne bloque pas la fermeture de l'apres-midi).
    if (!value) {
      const { data: conf, error: eConf } = await supabase
        .from("placement")
        .select("id")
        .eq("jour", jour)
        .eq("quart_code", quart_code)
        .not("poste_id", "is", null)
        .is("motif_absence_id", null)
        .limit(1);
      if (eConf) return NextResponse.json({ error: eConf.message }, { status: 403 });
      if ((conf ?? []).length > 0) {
        return NextResponse.json(
          { error: "Des affectations existent déjà sur ce quart ce jour-là. Videz-les d'abord dans Placement." },
          { status: 409 }
        );
      }
    }
    ({ error } = await supabase
      .from("jour_quart")
      .upsert({ jour, quart_code, actif: value }, { onConflict: "jour,quart_code" }));
  } else if (type === "ligne") {
    if (!ligne_id) return NextResponse.json({ error: "Ligne requise" }, { status: 400 });
    // Blocage symetrique pour la fermeture d'une ligne : on regarde s'il y a
    // deja des affectations sur cette ligne, ce quart, ce jour. Les autres
    // lignes du meme quart ne comptent pas (fermer la Ligne 1 en Fab n'est pas
    // bloque par des affectations sur la Ligne 2 en Fab).
    if (!value) {
      const { data: conf, error: eConf } = await supabase
        .from("placement")
        .select("id, poste:poste_id!inner(ligne_id)")
        .eq("jour", jour)
        .eq("quart_code", quart_code)
        .eq("poste.ligne_id", ligne_id)
        .not("poste_id", "is", null)
        .is("motif_absence_id", null)
        .limit(1);
      if (eConf) return NextResponse.json({ error: eConf.message }, { status: 403 });
      if ((conf ?? []).length > 0) {
        return NextResponse.json(
          { error: "Des affectations existent déjà sur cette ligne ce jour-là. Videz-les d'abord dans Placement." },
          { status: 409 }
        );
      }
    }
    ({ error } = await supabase
      .from("ouverture_quart")
      .upsert({ jour, ligne_id, quart_code, ouverte: value }, { onConflict: "jour,ligne_id,quart_code" }));
  } else {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
