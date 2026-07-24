import { getServerClient } from "@/lib/supabase-server";

// Parametres d'affichage du planning (fenetre glissante autour d'aujourd'hui).
// Un seul enregistrement partage par toute l'appli (cf. migration 0040).
export type FenetreAffichage = { jours_avant: number; jours_apres: number };

const DEFAUT: FenetreAffichage = { jours_avant: 1, jours_apres: 4 };

export async function getFenetreAffichage(): Promise<FenetreAffichage> {
  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from("parametre_affichage")
      .select("jours_avant, jours_apres")
      .eq("id", 1)
      .maybeSingle<FenetreAffichage>();
    if (error || !data) return DEFAUT;
    return { jours_avant: data.jours_avant, jours_apres: data.jours_apres };
  } catch {
    // Migration 0040 non appliquee : on retombe sur J-1 / J+4 pour ne pas casser.
    return DEFAUT;
  }
}
