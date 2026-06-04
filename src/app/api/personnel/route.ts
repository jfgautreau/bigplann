import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/personnel { op, ... }
// Saisie inline du personnel. Ecriture admin (RLS personne).
// Ops : create | update | toggle-statut.
const COLS = "id, matricule, nom, prenom, equipe_id, type_contrat, pointure, statut";
const CONTRATS = ["CDI", "CDD", "INTERIM"];

type Body = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

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

    return NextResponse.json({ error: "Op inconnue" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
