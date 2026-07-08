import { NextResponse, type NextRequest } from "next/server";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWriteModule } from "@/lib/permissions";

// POST /api/absence { op, ... }
// op = "save"   { personne_id, date_debut, date_fin, motif_absence_id, commentaire }
//      -> cree une absence (plage) et materialise un placement par jour (motif).
// op = "delete" { id }  -> supprime l'absence (cascade : placements lies effaces).
const s = (v: unknown) => String(v ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

// Liste des jours ISO (YYYY-MM-DD) de date_debut a date_fin inclus.
function joursRange(debut: string, fin: string): string[] {
  const out: string[] = [];
  const d = new Date(debut + "T00:00:00");
  const end = new Date(fin + "T00:00:00");
  let guard = 0;
  while (d <= end && guard < 800) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const op = s(body?.op);
  if (!body || !op) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const supabase = (await canWriteModule(profile.role, "planning")) ? getAdminClient() : await getServerClient();

  try {
    if (op === "save") {
      const personne_id = s(body.personne_id);
      const date_debut = s(body.date_debut);
      const date_fin = s(body.date_fin);
      const motif_absence_id = orNull(s(body.motif_absence_id));
      const commentaire = orNull(s(body.commentaire));
      if (!personne_id || !date_debut || !date_fin) {
        return NextResponse.json({ error: "Personne, date de début et de fin requises." }, { status: 400 });
      }
      if (date_fin < date_debut) {
        return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
      }
      if (!motif_absence_id) {
        return NextResponse.json({ error: "Motif d'absence requis." }, { status: 400 });
      }

      // 1) Cree la plage d'absence (source de verite).
      const { data: abs, error: aErr } = await supabase
        .from("absence")
        .insert({ personne_id, motif_absence_id, date_debut, date_fin, commentaire, created_by: profile.authId })
        .select("id, personne_id, motif_absence_id, date_debut, date_fin, commentaire")
        .single();
      if (aErr) throw aErr;
      const absence = abs as { id: string };

      // 2) Materialise un placement par jour (le motif apparait dans le planning).
      const rows = joursRange(date_debut, date_fin).map((jour) => ({
        personne_id,
        jour,
        equipe_id: null,
        poste_id: null,
        motif_absence_id,
        non_travaille: false,
        quart_code: null,
        absence_id: absence.id,
        created_by: profile.authId,
      }));
      const { error: pErr } = await supabase.from("placement").upsert(rows, { onConflict: "personne_id,jour" });
      if (pErr) {
        // Rollback de la plage si la materialisation echoue.
        await supabase.from("absence").delete().eq("id", absence.id);
        throw pErr;
      }
      return NextResponse.json({ ok: true, row: abs });
    }

    if (op === "update") {
      const id = s(body.id);
      const date_debut = s(body.date_debut);
      const date_fin = s(body.date_fin);
      const motif_absence_id = orNull(s(body.motif_absence_id));
      const commentaire = orNull(s(body.commentaire));
      if (!id || !date_debut || !date_fin) {
        return NextResponse.json({ error: "id et dates requis." }, { status: 400 });
      }
      if (date_fin < date_debut) {
        return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
      }
      if (!motif_absence_id) {
        return NextResponse.json({ error: "Motif d'absence requis." }, { status: 400 });
      }

      // Personne de l'absence (pour rematerialiser les placements).
      const { data: cur, error: cErr } = await supabase
        .from("absence")
        .select("personne_id")
        .eq("id", id)
        .single();
      if (cErr) throw cErr;
      const personne_id = (cur as { personne_id: string }).personne_id;

      const { error: uErr } = await supabase
        .from("absence")
        .update({ motif_absence_id, date_debut, date_fin, commentaire })
        .eq("id", id);
      if (uErr) throw uErr;

      // Rematerialise : on retire les anciens jours de cette absence puis on recree
      // un placement par jour de la nouvelle plage (le motif suit dans le planning).
      await supabase.from("placement").delete().eq("absence_id", id);
      const rows = joursRange(date_debut, date_fin).map((jour) => ({
        personne_id,
        jour,
        equipe_id: null,
        poste_id: null,
        motif_absence_id,
        non_travaille: false,
        quart_code: null,
        absence_id: id,
        created_by: profile.authId,
      }));
      const { error: pErr } = await supabase.from("placement").upsert(rows, { onConflict: "personne_id,jour" });
      if (pErr) throw pErr;
      return NextResponse.json({ ok: true });
    }

    if (op === "delete") {
      const id = s(body.id);
      if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
      // Cascade : les placements lies (absence_id) sont supprimes par la FK.
      const { error } = await supabase.from("absence").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Op inconnue" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
