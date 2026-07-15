import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWriteModule } from "@/lib/permissions";

// POST /api/habilitations/autorisation { id, date_autorisation_conduite }
// Met a jour la seule date de remise de l'autorisation de conduite d'un
// enregistrement personne_competence (edition inline, apres coup). Perimetre :
// admin -> client admin ; chef d'equipe -> client RLS (can_edit_personne).
const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { id?: string; date_autorisation_conduite?: string } | null;
  const id = String(body?.id ?? "");
  const raw = String(body?.date_autorisation_conduite ?? "").trim();
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
  if (raw && !isIso(raw)) return NextResponse.json({ error: "date invalide" }, { status: 400 });

  const supabase = (await canWriteModule(profile.role, "habilitations")) ? getAdminClient() : await getServerClient();
  const { error } = await supabase
    .from("personne_competence")
    .update({ date_autorisation_conduite: raw || null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
