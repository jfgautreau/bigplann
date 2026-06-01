"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

// Enregistre tous les niveaux (actuel/cible) d'une personne pour les postes
// affiches. La RLS (can_edit_personne) autorise admin ou chef de l'equipe.
export async function saveMatriceRow(fd: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Non authentifie.");
  const supabase = await getServerClient();

  const personne_id = String(fd.get("personne_id") ?? "");
  if (!personne_id) return;

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^actuel_(.+)$/);
    if (!m) continue;
    const poste_id = m[1];
    rows.push({
      personne_id,
      poste_id,
      niveau_actuel: Number(v || 0),
      niveau_cible: Number(fd.get(`cible_${poste_id}`) || 0),
      auteur_app_user_id: profile.authId,
      date_maj: now,
    });
  }

  if (rows.length) {
    await supabase.from("matrice").upsert(rows, { onConflict: "personne_id,poste_id" });
  }
  revalidatePath("/matrice");
}
