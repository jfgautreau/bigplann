import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canRead, getPermissions } from "@/lib/permissions";
import { fetchAll } from "@/lib/fetch-all";
import { grouperAbsences, type JourAbsence } from "@/lib/absences-periodes";

// GET /api/personnel/[id]/absences
// Historique d'absence d'une personne, regroupe en periodes (plus recent d'abord).
//
// Lecture SEULE et chargee A LA DEMANDE (a l'ouverture de la modale) : l'historique
// complet de tout l'effectif represente deja des centaines de lignes et ne cesse de
// croitre — le charger avec la liste du personnel serait payer ce cout a chaque
// affichage de l'ecran pour une modale qu'on n'ouvre presque jamais.
//
// Le droit « personnel: read » suffit : c'est une consultation. La declaration,
// elle, passe par /api/absence, qui porte ses propres gardes.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canRead(await getPermissions(profile.role), "personnel")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  const supabase = await getServerClient();

  // On part des JOURS et non de la table `absence` : 401 des 421 jours d'absence
  // sont saisis directement au Planning, sans periode declaree (cf.
  // src/lib/absences-periodes.ts). fetchAll : l'historique d'une personne peut
  // depasser 1000 lignes sur plusieurs annees (cf. L8).
  const jours = await fetchAll<JourAbsence>(() =>
    supabase
      .from("placement")
      .select("jour, motif_absence_id, absence_id")
      .eq("personne_id", id)
      .not("motif_absence_id", "is", null)
      .order("jour")
      .returns<JourAbsence[]>()
  );

  // Commentaires des absences declarees, par absence_id : le regroupement en
  // periodes vit dans grouperAbsences (source = les JOURS), la table
  // `absence` porte seule le commentaire.
  const idsDeclares = Array.from(new Set(jours.map((j) => j.absence_id).filter((x): x is string => !!x)));
  const commentaires: Record<string, string> = {};
  if (idsDeclares.length) {
    const { data: absData } = await supabase
      .from("absence")
      .select("id, commentaire")
      .in("id", idsDeclares)
      .returns<{ id: string; commentaire: string | null }[]>();
    for (const a of absData ?? []) commentaires[a.id] = a.commentaire ?? "";
  }

  const periodes = grouperAbsences(jours).map((p) => ({
    ...p,
    commentaire: p.absence_id ? commentaires[p.absence_id] ?? "" : "",
  }));

  return NextResponse.json({ ok: true, periodes });
}
