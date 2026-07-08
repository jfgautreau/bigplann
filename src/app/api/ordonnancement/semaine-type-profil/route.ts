import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// POST /api/ordonnancement/semaine-type-profil { op, ... }
// Gestion des profils de semaine type. Ecriture admin/ordo (RLS).
//   op = create { nom }               -> cree un profil
//        rename { id, nom }
//        delete { id }                -> supprime (cascade gabarit)
//        set-default { id }           -> marque ce profil par defaut
const s = (v: unknown) => String(v ?? "").trim();

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const op = s(body?.op);
  if (!op) return NextResponse.json({ error: "Requete invalide" }, { status: 400 });

  const supabase = await getServerClient();

  try {
    if (op === "create") {
      const nom = s(body?.nom) || "Nouveau profil";
      const { data, error } = await supabase
        .from("semaine_type_profil")
        .insert({ nom })
        .select("id, nom, par_defaut")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, row: data });
    }

    if (op === "rename") {
      const id = s(body?.id);
      const nom = s(body?.nom);
      if (!id || !nom) return NextResponse.json({ error: "Champs requis" }, { status: 400 });
      const { error } = await supabase.from("semaine_type_profil").update({ nom }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (op === "delete") {
      const id = s(body?.id);
      if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
      const { error } = await supabase.from("semaine_type_profil").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (op === "set-default") {
      const id = s(body?.id);
      if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
      // Un seul profil par defaut a la fois.
      const { error: e1 } = await supabase.from("semaine_type_profil").update({ par_defaut: false }).neq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("semaine_type_profil").update({ par_defaut: true }).eq("id", id);
      if (e2) throw e2;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Op inconnue" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
