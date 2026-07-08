import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWriteModule } from "@/lib/permissions";

// POST /api/ordonnancement/rotation { cells: [{ equipe_id, semaine, quart_code }] }
// quart_code "" (ou invalide) => la rotation de cette (équipe, semaine) est effacée.
// admin, rôle ordo, ou droit "ordonnancement: write".
const VALID = ["journee", "matin", "apres_midi", "nuit"];
const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  const ok = profile && (profile.role === "admin" || profile.role === "ordo" || (await canWriteModule(profile.role, "ordonnancement")));
  if (!ok) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { cells?: { equipe_id?: string; semaine?: string; quart_code?: string }[] } | null;
  const cells = body?.cells ?? [];
  const ups: { equipe_id: string; semaine: string; quart_code: string }[] = [];
  const delKeys: { equipe_id: string; semaine: string }[] = [];
  for (const c of cells) {
    const equipe_id = String(c.equipe_id ?? "");
    const semaine = String(c.semaine ?? "");
    const quart = String(c.quart_code ?? "");
    if (!equipe_id || !isIso(semaine)) continue;
    if (VALID.includes(quart)) ups.push({ equipe_id, semaine, quart_code: quart });
    else delKeys.push({ equipe_id, semaine });
  }

  const supabase = getAdminClient();
  if (ups.length) {
    const { error } = await supabase.from("equipe_quart_semaine").upsert(ups, { onConflict: "equipe_id,semaine" });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  }
  for (const d of delKeys) {
    await supabase.from("equipe_quart_semaine").delete().eq("equipe_id", d.equipe_id).eq("semaine", d.semaine);
  }
  return NextResponse.json({ ok: true, saved: ups.length, cleared: delKeys.length });
}
