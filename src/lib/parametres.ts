import { getServerClient } from "@/lib/supabase-server";

// Parametres d'affichage du planning (fenetre glissante autour d'aujourd'hui).
// Une ligne par site (PK site_id depuis la migration 0051). La RLS filtre
// automatiquement sur le site courant.
export type FenetreAffichage = { jours_avant: number; jours_apres: number };

export const FENETRE_DEFAUT: FenetreAffichage = { jours_avant: 1, jours_apres: 4 };

export async function getFenetreAffichage(): Promise<FenetreAffichage> {
  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from("parametre_affichage")
      .select("jours_avant, jours_apres")
      .maybeSingle<FenetreAffichage>();
    if (error || !data) return FENETRE_DEFAUT;
    return { jours_avant: data.jours_avant, jours_apres: data.jours_apres };
  } catch {
    return FENETRE_DEFAUT;
  }
}
