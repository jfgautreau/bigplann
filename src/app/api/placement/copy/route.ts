import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWritePlacementData } from "@/lib/permissions";

// POST /api/placement/copy { source, cible, quart }
// Copie les affectations SUR POSTE d'un quart depuis un jour source vers un jour
// cible (upsert par personne/jour). Les absences ne sont pas copiees (specifiques
// au jour). Perimetre : planning:write -> admin ; sinon RLS (chef -> son equipe).
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { source?: string; cible?: string; quart?: string } | null;
  const source = String(body?.source ?? "");
  const cible = String(body?.cible ?? "");
  const quart = String(body?.quart ?? "");
  if (!isDate(source) || !isDate(cible) || !quart) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  if (source === cible) return NextResponse.json({ error: "Jours identiques" }, { status: 400 });

  const supabase = (await canWritePlacementData(profile.role)) ? getAdminClient() : await getServerClient();

  // Placements sur poste du quart, jour source.
  const { data: src, error: e1 } = await supabase
    .from("placement")
    .select("personne_id, poste_id, equipe_id, quart_code")
    .eq("jour", source)
    .not("poste_id", "is", null)
    .returns<{ personne_id: string; poste_id: string; equipe_id: string | null; quart_code: string | null }[]>();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 403 });

  const rows = (src ?? [])
    .filter((r) => (r.quart_code ?? "matin") === quart)
    .map((r) => ({
      personne_id: r.personne_id,
      jour: cible,
      poste_id: r.poste_id,
      equipe_id: r.equipe_id,
      quart_code: quart,
      motif_absence_id: null,
      non_travaille: false,
      created_by: profile.authId,
    }));

  if (!rows.length) return NextResponse.json({ ok: true, copied: 0 });

  const { error: e2 } = await supabase.from("placement").upsert(rows, { onConflict: "personne_id,jour" });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 403 });
  return NextResponse.json({ ok: true, copied: rows.length, rows: rows.map((r) => ({ personne_id: r.personne_id, poste_id: r.poste_id })) });
}
