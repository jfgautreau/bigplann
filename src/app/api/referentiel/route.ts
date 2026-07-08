import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/referentiel  { op, ... }
// Saisie inline du referentiel (ateliers / lignes / postes). Ecriture admin (RLS).
// Ops : create-atelier | create-ligne | create-poste | update-atelier |
//       update-ligne | update-poste | toggle.
const POSTE_COLS =
  "id, nom, nom_court, est_conducteur, categorie, effectif_requis, difficulte_formation, niveau_min_requis, ordre_affichage, actif";
const CATEGORIES = ["manager", "conducteur", "operateur"];

type Body = Record<string, unknown>;

const s = (v: unknown) => String(v ?? "").trim();

// Normalise une valeur de champ poste selon sa colonne.
function posteValue(key: string, value: unknown) {
  switch (key) {
    case "nom":
      return s(value);
    case "nom_court":
      return s(value).slice(0, 6) || null;
    case "est_conducteur":
      return value === true || value === "true";
    case "categorie":
      return CATEGORIES.includes(s(value)) ? s(value) : undefined;
    case "effectif_requis":
      return Math.max(0, Math.floor(Number(value) || 0));
    case "niveau_min_requis":
      return Math.max(0, Math.min(4, Math.floor(Number(value) || 0)));
    case "ordre_affichage":
      return Math.max(0, Math.floor(Number(value) || 0));
    case "difficulte_formation": {
      const v = s(value);
      return v === "" ? null : Math.max(1, Math.min(3, Number(v)));
    }
    default:
      return undefined;
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
    switch (op) {
      case "create-atelier": {
        const nom = s(body.nom);
        if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
        const { data, error } = await supabase
          .from("atelier")
          .insert({ nom })
          .select("id, nom, actif")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, row: { ...data, ligne: [] } });
      }
      case "create-ligne": {
        const nom = s(body.nom);
        const atelier_id = s(body.atelier_id);
        if (!nom || !atelier_id) return NextResponse.json({ error: "Champs requis" }, { status: 400 });
        const { data, error } = await supabase
          .from("ligne")
          .insert({ nom, atelier_id })
          .select("id, nom, actif, ordre_affichage")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, row: { ...data, poste: [] } });
      }
      case "create-poste": {
        const nom = s(body.nom);
        const ligne_id = s(body.ligne_id);
        // nom facultatif à la création : la ligne apparaît vide (placeholder gris),
        // l'utilisateur saisit le nom ensuite.
        if (!ligne_id) return NextResponse.json({ error: "Champs requis" }, { status: 400 });
        const { data, error } = await supabase
          .from("poste")
          .insert({ ligne_id, nom })
          .select(POSTE_COLS)
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, row: data });
      }
      case "update-atelier": {
        const { error } = await supabase.from("atelier").update({ nom: s(body.nom) }).eq("id", s(body.id));
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case "update-ligne": {
        const patch: Record<string, unknown> = {};
        if (body.nom !== undefined) patch.nom = s(body.nom);
        if (body.ordre_affichage !== undefined) patch.ordre_affichage = Math.max(0, Math.floor(Number(body.ordre_affichage) || 0));
        if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
        const { error } = await supabase.from("ligne").update(patch).eq("id", s(body.id));
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case "update-poste": {
        const patchIn = (body.patch ?? {}) as Body;
        const patch: Record<string, unknown> = {};
        for (const k of Object.keys(patchIn)) {
          const v = posteValue(k, patchIn[k]);
          if (v !== undefined) patch[k] = v;
        }
        if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
        const { error } = await supabase.from("poste").update(patch).eq("id", s(body.id));
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case "poste-quart": {
        // Activation poste x quart. Defaut actif : actif=true -> on supprime la ligne,
        // actif=false -> on insere/maj une ligne de desactivation.
        const poste_id = s(body.poste_id);
        const quart_code = s(body.quart_code);
        if (!poste_id || !quart_code) return NextResponse.json({ error: "Champs requis" }, { status: 400 });
        const actif = body.actif === true || body.actif === "true";
        if (actif) {
          const { error } = await supabase
            .from("poste_quart")
            .delete()
            .eq("poste_id", poste_id)
            .eq("quart_code", quart_code);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("poste_quart")
            .upsert({ poste_id, quart_code, actif: false }, { onConflict: "poste_id,quart_code" });
          if (error) throw error;
        }
        return NextResponse.json({ ok: true });
      }
      case "toggle": {
        const entity = s(body.entity);
        if (!["atelier", "ligne", "poste"].includes(entity))
          return NextResponse.json({ error: "Entité inconnue" }, { status: 400 });
        const { error } = await supabase
          .from(entity)
          .update({ actif: body.actif === true || body.actif === "true" })
          .eq("id", s(body.id));
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Op inconnue" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
