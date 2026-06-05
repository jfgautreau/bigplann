import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/personnel { op, ... }
// Saisie inline du personnel. Ecriture admin (RLS personne).
// Ops : create | update | toggle-statut
//       | periode-list | periode-create | periode-update | periode-delete
const COLS = "id, matricule, nom, prenom, equipe_id, type_contrat, date_fin, pointure, statut";
const PERIODE_COLS = "id, personne_id, type_contrat, agence_interim, date_debut, date_fin, commentaire";
const CONTRATS = ["CDI", "CDD", "INTERIM"];

type Body = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

type PeriodeRow = {
  type_contrat: string;
  agence_interim: string | null;
  date_debut: string | null;
  date_fin: string | null;
  created_at: string;
};

// Recalcule le reflet denormalise de personne a partir de la periode la plus
// recente (date_debut desc, nulls en dernier, puis created_at desc).
// Best-effort : si la table contrat_periode n'existe pas encore, on ignore.
async function syncPersonneFromPeriodes(supabase: SupabaseClient, personne_id: string) {
  try {
    const { data } = await supabase
      .from("contrat_periode")
      .select("type_contrat, agence_interim, date_debut, date_fin, created_at")
      .eq("personne_id", personne_id)
      .returns<PeriodeRow[]>();
    const periods = data ?? [];
    if (periods.length === 0) return;
    periods.sort((a, b) => {
      const da = a.date_debut ?? "";
      const db = b.date_debut ?? "";
      if (da !== db) return db.localeCompare(da); // dates reelles d'abord, null en dernier
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    const latest = periods[0];
    await supabase
      .from("personne")
      .update({
        type_contrat: latest.type_contrat,
        agence_interim: latest.agence_interim,
        date_debut: latest.date_debut,
        date_fin: latest.date_fin,
      })
      .eq("id", personne_id);
  } catch {
    // table absente (migration 0017 non encore appliquee) -> on ignore
  }
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const op = s(body?.op);
  if (!body || !op) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const supabase = await getServerClient();

  try {
    if (op === "create") {
      const nom = s(body.nom);
      const prenom = s(body.prenom);
      if (!nom || !prenom) return NextResponse.json({ error: "Nom et prénom requis" }, { status: 400 });
      const type_contrat = CONTRATS.includes(s(body.type_contrat)) ? s(body.type_contrat) : "CDI";
      let matricule = orNull(s(body.matricule));
      if (!matricule && type_contrat === "INTERIM") matricule = `INT-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from("personne")
        .insert({
          nom,
          prenom,
          equipe_id: orNull(s(body.equipe_id)),
          type_contrat,
          matricule,
          agence_interim: type_contrat === "INTERIM" ? orNull(s(body.agence_interim)) : null,
          date_debut: orNull(s(body.date_debut)),
          date_fin: orNull(s(body.date_fin)),
          pointure: orNull(s(body.pointure)),
          commentaire: orNull(s(body.commentaire)),
        })
        .select(COLS)
        .single();
      if (error) throw error;
      // Periode de contrat initiale (best-effort : ignore si table absente).
      const created = data as { id: string };
      try {
        await supabase.from("contrat_periode").insert({
          personne_id: created.id,
          type_contrat,
          agence_interim: type_contrat === "INTERIM" ? orNull(s(body.agence_interim)) : null,
          date_debut: orNull(s(body.date_debut)),
          date_fin: orNull(s(body.date_fin)),
        });
      } catch {
        /* migration 0017 non appliquee : on garde juste personne */
      }
      return NextResponse.json({ ok: true, row: data });
    }

    if (op === "update") {
      const id = s(body.id);
      if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
      const patchIn = (body.patch ?? {}) as Body;
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(patchIn)) {
        const v = patchIn[k];
        switch (k) {
          case "nom":
          case "prenom":
            patch[k] = s(v);
            break;
          case "matricule":
          case "pointure":
            patch[k] = orNull(s(v));
            break;
          case "equipe_id":
            patch[k] = orNull(s(v));
            break;
          case "type_contrat":
            if (CONTRATS.includes(s(v))) {
              patch.type_contrat = s(v);
              if (s(v) !== "INTERIM") patch.agence_interim = null;
            }
            break;
        }
      }
      if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
      const { error } = await supabase.from("personne").update(patch).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (op === "toggle-statut") {
      const id = s(body.id);
      const statut = s(body.statut) === "PARTI" ? "PARTI" : "ACTIF";
      const { error } = await supabase.from("personne").update({ statut }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // ----- Periodes de contrat -----
    if (op === "periode-list") {
      const personne_id = s(body.personne_id);
      if (!personne_id) return NextResponse.json({ error: "personne_id manquant" }, { status: 400 });
      const { data, error } = await supabase
        .from("contrat_periode")
        .select(PERIODE_COLS)
        .eq("personne_id", personne_id)
        .order("date_debut", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ ok: true, rows: data ?? [] });
    }

    if (op === "periode-create") {
      const personne_id = s(body.personne_id);
      if (!personne_id) return NextResponse.json({ error: "personne_id manquant" }, { status: 400 });
      const type_contrat = CONTRATS.includes(s(body.type_contrat)) ? s(body.type_contrat) : "CDI";
      const { data, error } = await supabase
        .from("contrat_periode")
        .insert({
          personne_id,
          type_contrat,
          agence_interim: type_contrat === "INTERIM" ? orNull(s(body.agence_interim)) : null,
          date_debut: orNull(s(body.date_debut)),
          date_fin: orNull(s(body.date_fin)),
          commentaire: orNull(s(body.commentaire)),
        })
        .select(PERIODE_COLS)
        .single();
      if (error) throw error;
      await syncPersonneFromPeriodes(supabase, personne_id);
      return NextResponse.json({ ok: true, row: data });
    }

    if (op === "periode-update") {
      const id = s(body.id);
      const personne_id = s(body.personne_id);
      if (!id || !personne_id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
      const patchIn = (body.patch ?? {}) as Body;
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(patchIn)) {
        const v = patchIn[k];
        switch (k) {
          case "type_contrat":
            if (CONTRATS.includes(s(v))) {
              patch.type_contrat = s(v);
              if (s(v) !== "INTERIM") patch.agence_interim = null;
            }
            break;
          case "agence_interim":
          case "commentaire":
            patch[k] = orNull(s(v));
            break;
          case "date_debut":
          case "date_fin":
            patch[k] = orNull(s(v));
            break;
        }
      }
      if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
      const { error } = await supabase.from("contrat_periode").update(patch).eq("id", id);
      if (error) throw error;
      await syncPersonneFromPeriodes(supabase, personne_id);
      return NextResponse.json({ ok: true });
    }

    if (op === "periode-delete") {
      const id = s(body.id);
      const personne_id = s(body.personne_id);
      if (!id || !personne_id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
      const { error } = await supabase.from("contrat_periode").delete().eq("id", id);
      if (error) throw error;
      await syncPersonneFromPeriodes(supabase, personne_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Op inconnue" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
