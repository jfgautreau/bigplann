import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWriteModule } from "@/lib/permissions";
import { addMonthsIso, habValable } from "@/lib/habilitations";

type SupabaseClient = Awaited<ReturnType<typeof getServerClient>>;

// Habilitations exigees par le poste que la personne n'a pas (ou plus). Recalcule
// ici plutot que de croire le client : le drapeau de forcage sert de trace d'audit.
async function habManquantes(supabase: SupabaseClient, personne_id: string, poste_id: string): Promise<string[]> {
  const { data: reqs } = await supabase
    .from("poste_competence_requise")
    .select("competence_id, competence:competence_id(nom, duree_validite_mois)")
    .eq("poste_id", poste_id)
    .returns<{ competence_id: string; competence: { nom: string; duree_validite_mois: number | null } | null }[]>();
  if (!reqs?.length) return [];

  const { data: det } = await supabase
    .from("personne_competence")
    .select("competence_id, date_obtention, date_expiration")
    .eq("personne_id", personne_id)
    .in("competence_id", reqs.map((r) => r.competence_id))
    .returns<{ competence_id: string; date_obtention: string | null; date_expiration: string | null }[]>();

  const parComp = new Map((det ?? []).map((d) => [d.competence_id, d]));
  return reqs
    .filter((r) => {
      const d = parComp.get(r.competence_id);
      if (!d) return true;
      // date_expiration est stockee a la saisie : repli sur obtention + duree.
      const exp = d.date_expiration ?? addMonthsIso(d.date_obtention, r.competence?.duree_validite_mois);
      return !habValable({ expiration: exp });
    })
    .map((r) => r.competence?.nom ?? "habilitation");
}

// POST /api/placement/cell { personne_id, jour, equipe_id, value, forcer }
//   value = ""  -> efface le placement
//   value = "X" -> jour non travaille
//   value = <poste_id> -> affecte au poste
//   forcer = true -> accepte le poste malgre une habilitation manquante/expiree
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    personne_id?: string;
    jour?: string;
    equipe_id?: string | null;
    quart?: string | null;
    value?: string;
    forcer?: boolean;
  } | null;

  const personne_id = body?.personne_id;
  const jour = body?.jour;
  const value = body?.value ?? "";
  if (!personne_id || !jour) {
    return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });
  }

  // Droit "planning: write" -> client admin (édition complète) ; sinon RLS
  // (admin ou chef de l'équipe de la personne).
  const supabase = (await canWriteModule(profile.role, "planning")) ? getAdminClient() : await getServerClient();

  if (value === "") {
    const { error } = await supabase
      .from("placement")
      .delete()
      .eq("personne_id", personne_id)
      .eq("jour", jour);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  let poste_id: string | null = null;
  let motif_absence_id: string | null = null;
  let non_travaille = false;
  if (value === "X") non_travaille = true;
  else if (value.startsWith("m:")) motif_absence_id = value.slice(2);
  else poste_id = value;

  // Le quart ne s'applique qu'a un placement sur poste (une absence/NT vaut
  // pour toute la journee, tous quarts).
  const quart_code = poste_id ? (body?.quart ?? null) : null;

  // Une personne placee sur un poste un quart ne peut pas etre placee sur un
  // poste d'un autre quart le meme jour (legacy quart null = matin).
  if (poste_id) {
    const { data: existing } = await supabase
      .from("placement")
      .select("poste_id, quart_code")
      .eq("personne_id", personne_id)
      .eq("jour", jour)
      .maybeSingle<{ poste_id: string | null; quart_code: string | null }>();
    if (existing?.poste_id) {
      const exQ = existing.quart_code ?? "matin";
      const newQ = quart_code ?? "matin";
      if (exQ !== newQ) {
        return NextResponse.json(
          { error: "Personne deja placee sur un autre quart ce jour-la." },
          { status: 409 }
        );
      }
    }
  }

  // Habilitations exigees par le poste. Sans confirmation explicite du client, on
  // refuse et on renvoie ce qui manque : c'est ce qui alimente la modale de forcage.
  const manquantes = poste_id ? await habManquantes(supabase, personne_id, poste_id) : [];
  const forcer = body?.forcer === true;
  if (manquantes.length && !forcer) {
    return NextResponse.json({ error: "Habilitation manquante", manquantes }, { status: 428 });
  }

  const { error } = await supabase.from("placement").upsert(
    {
      personne_id,
      jour,
      equipe_id: body?.equipe_id ?? null,
      poste_id,
      motif_absence_id,
      non_travaille,
      quart_code,
      created_by: profile.authId,
      // Trace d'audit : seul un placement reellement en manque compte comme force.
      forcage_habilitation: manquantes.length > 0,
      forcage_auteur_app_user_id: manquantes.length ? profile.authId : null,
      forcage_le: manquantes.length ? new Date().toISOString() : null,
    },
    { onConflict: "personne_id,jour" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
