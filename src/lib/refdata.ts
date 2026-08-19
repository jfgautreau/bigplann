import { unstable_cache } from "next/cache";
import { getAdminClient } from "@/lib/supabase-server";
import { getCurrentSite } from "@/lib/current-site";

// Donnees de reference (rarement modifiees, identiques pour tous les users) mises
// en cache pour ne pas etre rechargees a chaque clic de filtre / navigation.
// Lecture via le client service (hors cookies) -> cacheable. Invalidation par
// expiration courte (les edits de reference se refletent en <= 30 s).
//
// ⚠️ MULTI-SITE : le cache est SEGMENTÉ PAR SITE. Le siteId passe en argument
// des fonctions cachées ; Next.js l'inclut dans la clé de cache, donc deux sites
// n'écrasent JAMAIS le cache l'un de l'autre. Ne jamais retirer cet argument :
// sans lui, on servirait les ateliers du site A à un utilisateur du site B.
const OPTS = { revalidate: 30 };

async function siteId(): Promise<string> {
  return (await getCurrentSite()).id;
}

// Helper : applique un filtre .eq("site_id", ...) et retente sans le
// filtre si la colonne n'existe pas encore (fenêtre pré-migration 0043).
// Retirer ces fallbacks une fois la 0043 en prod.
async function siteFilteredOrLegacy<T>(
  build: () => {
    modern: () => PromiseLike<{ data: T[] | null; error: unknown }>;
    legacy: () => PromiseLike<{ data: T[] | null; error: unknown }>;
  }
): Promise<T[]> {
  const { modern, legacy } = build();
  const mres = await modern();
  if (!mres.error) return (mres.data ?? []) as T[];
  const lres = await legacy();
  return (lres.data ?? []) as T[];
}

// -------- Ateliers -------------------------------------------------

const getAteliersBySite = unstable_cache(
  async (site: string) => {
    return siteFilteredOrLegacy<{ id: string; nom: string }>(() => {
      const base = () =>
        getAdminClient().from("atelier").select("id, nom").eq("actif", true);
      return {
        modern: () => base().eq("site_id", site).order("nom"),
        legacy: () => base().order("nom"),
      };
    });
  },
  ["refdata-ateliers"],
  OPTS
);
export async function getAteliersC() {
  return getAteliersBySite(await siteId());
}

// -------- Equipes --------------------------------------------------

type EquipeRow = {
  id: string;
  nom: string;
  couleur: string | null;
  quart_fixe: string | null;
};

const getEquipesBySite = unstable_cache(
  async (site: string) => {
    return siteFilteredOrLegacy<EquipeRow>(() => {
      const base = () =>
        getAdminClient()
          .from("equipe")
          .select("id, nom, couleur, quart_fixe")
          .eq("actif", true);
      return {
        modern: () => base().eq("site_id", site).order("nom"),
        legacy: () => base().order("nom"),
      };
    });
  },
  ["refdata-equipes"],
  OPTS
);
export async function getEquipesC() {
  return getEquipesBySite(await siteId());
}

// -------- Quarts ---------------------------------------------------
// Table `quart` reste globale en V1 (référentiel commun à toutes les
// usines). Pas de siteId ici. Si un site veut ses propres codes, on
// site-scopera plus tard.

export const getQuartsC = unstable_cache(
  async () => {
    const { data } = await getAdminClient()
      .from("quart")
      .select("code, libelle, ordre")
      .order("ordre");
    return (data ?? []) as { code: string; libelle: string; ordre: number }[];
  },
  ["refdata-quarts"],
  OPTS
);

// -------- Motifs d'absence -----------------------------------------
// Table partagée : lignes groupe (site_id NULL) + surcharges locales
// (site_id = site courant). La RLS renvoie l'union ; le tri place les
// codes locaux en premier pour qu'une surcharge éclipse une valeur groupe
// portant le même code_court (résolu applicativement au premier tombé).

type MotifRow = {
  id: string;
  code_court: string;
  libelle: string;
  couleur: string;
  site_id: string | null;
};

const getMotifsBySite = unstable_cache(
  async (site: string) => {
    return siteFilteredOrLegacy<MotifRow>(() => {
      const modern = () =>
        getAdminClient()
          .from("motif_absence")
          .select("id, code_court, libelle, couleur, site_id")
          .eq("actif", true)
          .or(`site_id.is.null,site_id.eq.${site}`)
          .order("libelle");
      const legacy = () =>
        getAdminClient()
          .from("motif_absence")
          .select("id, code_court, libelle, couleur")
          .eq("actif", true)
          .order("libelle")
          .then((r) => ({
            data: (r.data ?? []).map((x) => ({
              ...(x as Omit<MotifRow, "site_id">),
              site_id: null,
            })) as MotifRow[],
            error: r.error,
          }));
      return { modern, legacy };
    });
  },
  ["refdata-motifs"],
  OPTS
);
export async function getMotifsC() {
  return getMotifsBySite(await siteId());
}

// -------- Echelle des niveaux (0..4) -------------------------------
// Globale à toute la plateforme (échelle standard des matrices de
// polyvalence). Tag dédié pour invalidation immédiate depuis l'écran
// des libellés.
export const NIVEAUX_TAG = "refdata-niveaux";

export const getNiveauxC = unstable_cache(
  async () => {
    const { data } = await getAdminClient()
      .from("competence_niveau_libelle")
      .select("niveau, libelle")
      .order("niveau");
    return (data ?? []) as { niveau: number; libelle: string }[];
  },
  ["refdata-niveaux"],
  { ...OPTS, tags: [NIVEAUX_TAG] }
);

// -------- Références de rotation -----------------------------------
// Site-scopées : la rotation des équipes d'un site n'est pas celle d'un
// autre. Tag dédié invalide à chaque enregistrement.
export const ROTATION_TAG = "refdata-rotation";

type RotationRefRow = {
  semaine: string;
  equipe_id: string;
  quart_code: string;
};

const getRotationRefsBySite = unstable_cache(
  async (site: string) => {
    return siteFilteredOrLegacy<RotationRefRow>(() => {
      const base = () =>
        getAdminClient()
          .from("rotation_reference")
          .select("semaine, equipe_id, quart_code");
      return {
        modern: () => base().eq("site_id", site).order("semaine"),
        legacy: () => base().order("semaine"),
      };
    });
  },
  ["refdata-rotation"],
  { ...OPTS, tags: [ROTATION_TAG] }
);
export async function getRotationRefsC() {
  return getRotationRefsBySite(await siteId());
}
