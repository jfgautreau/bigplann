import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWriteModule } from "@/lib/permissions";
import { addMonthsIso } from "@/lib/habilitations";

// POST /api/habilitations { personne_id, competence_id, date_obtention, date_autorisation_conduite? }
// Enregistre (ou recycle) une habilitation. Pendant longtemps c'etait une server
// action ; la saisie se fait desormais au clic sur une pastille de la grille, donc
// depuis un composant client -> route API (cf. CLAUDE.md : un <select> controle ne se
// serialise pas de facon fiable dans un <form action={serverAction}>).
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    personne_id?: string;
    competence_id?: string;
    date_obtention?: string;
    date_autorisation_conduite?: string | null;
  } | null;

  const personne_id = String(body?.personne_id ?? "").trim();
  const competence_id = String(body?.competence_id ?? "").trim();
  const date_obtention = String(body?.date_obtention ?? "").trim();
  const date_autorisation_conduite = String(body?.date_autorisation_conduite ?? "").trim() || null;
  if (!personne_id || !competence_id || !date_obtention) {
    return NextResponse.json({ error: "Personne, formation et date de passage sont requises." }, { status: 400 });
  }

  // Ecriture complete (admin / rh) -> client admin ; sinon RLS (chef sur son equipe).
  const supabase = (await canWriteModule(profile.role, "habilitations")) ? getAdminClient() : await getServerClient();

  const { data: comp } = await supabase
    .from("competence")
    .select("duree_validite_mois, type")
    .eq("id", competence_id)
    .single<{ duree_validite_mois: number | null; type: string }>();

  // L'echeance est figee a la saisie (cf. CLAUDE.md) : recalculee ici a partir de
  // la duree de validite en vigueur au moment ou l'on enregistre.
  const date_expiration = addMonthsIso(date_obtention, comp?.duree_validite_mois);

  const { error } = await supabase.from("personne_competence").upsert(
    {
      personne_id,
      competence_id,
      date_obtention,
      date_expiration,
      date_autorisation_conduite,
      acquis: comp?.type === "ACQUIS" ? true : null,
      auteur_app_user_id: profile.authId,
      date_maj: new Date().toISOString(),
    },
    { onConflict: "personne_id,competence_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  revalidatePath("/habilitations");
  return NextResponse.json({ ok: true });
}
