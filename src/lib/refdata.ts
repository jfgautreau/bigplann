import { unstable_cache } from "next/cache";
import { getAdminClient } from "@/lib/supabase-server";

// Donnees de reference (rarement modifiees, identiques pour tous les users) mises
// en cache pour ne pas etre rechargees a chaque clic de filtre / navigation.
// Lecture via le client service (hors cookies) -> cacheable. Invalidation par
// expiration courte (les edits de reference se refletent en <= 30 s).
const OPTS = { revalidate: 30 };

export const getAteliersC = unstable_cache(
  async () => {
    const { data } = await getAdminClient().from("atelier").select("id, nom").eq("actif", true).order("nom");
    return (data ?? []) as { id: string; nom: string }[];
  },
  ["refdata-ateliers"],
  OPTS
);

export const getEquipesC = unstable_cache(
  async () => {
    const { data } = await getAdminClient().from("equipe").select("id, nom, couleur, quart_fixe").eq("actif", true).order("nom");
    return (data ?? []) as { id: string; nom: string; couleur: string | null; quart_fixe: string | null }[];
  },
  ["refdata-equipes"],
  OPTS
);

export const getQuartsC = unstable_cache(
  async () => {
    const { data } = await getAdminClient().from("quart").select("code, libelle, ordre").order("ordre");
    return (data ?? []) as { code: string; libelle: string; ordre: number }[];
  },
  ["refdata-quarts"],
  OPTS
);

export const getMotifsC = unstable_cache(
  async () => {
    const { data } = await getAdminClient().from("motif_absence").select("id, code_court, libelle, couleur").eq("actif", true).order("libelle");
    return (data ?? []) as { id: string; code_court: string; libelle: string; couleur: string }[];
  },
  ["refdata-motifs"],
  OPTS
);

// Tag dedie : l'edition des libelles (admin/competences) doit se refleter
// immediatement dans la legende de la matrice via revalidateTag, sans attendre
// l'expiration du cache.
export const NIVEAUX_TAG = "refdata-niveaux";

export const getNiveauxC = unstable_cache(
  async () => {
    const { data } = await getAdminClient().from("competence_niveau_libelle").select("niveau, libelle").order("niveau");
    return (data ?? []) as { niveau: number; libelle: string }[];
  },
  ["refdata-niveaux"],
  { ...OPTS, tags: [NIVEAUX_TAG] }
);
