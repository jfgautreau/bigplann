import { cache } from "react";
import { headers } from "next/headers";
import { getAdminClient } from "@/lib/supabase-server";

// Contexte multi-site (SaaS multi-tenant). Une seule base Supabase, un
// `site_id` sur chaque table métier locale, RLS pour l'isolation
// (cf. supabase/migrations/0043_multi_site.sql et tasks/multi-site.md).
//
// L'UUID du site historique « lebignon » est fixé en dur : il est écrit
// dans la migration 0043 comme DEFAULT temporaire des colonnes site_id
// (retiré ensuite), et sert de fallback tant que les sous-domaines ne sont
// pas en place. À terme, `getCurrentSite()` lit exclusivement le header
// `x-site-id` posé par le middleware après résolution du sous-domaine.
export const SITE_LEBIGNON_ID = "00000000-0000-4000-8000-00000000c0de";

export type CurrentSite = {
  id: string;
  slug: string;
  nom: string;
  statut: "actif" | "suspendu" | "archive";
  fuseau: string;
};

// Fallback statique utilisé tant que la migration 0043 n'a pas été jouée
// (la table `site` n'existe pas encore) OU si la requête échoue pour tout
// autre motif. Bloc à supprimer après plusieurs semaines en prod avec la
// 0043 appliquée : à ce moment-là, un throw est préférable à un fallback
// silencieux.
const FALLBACK_LEBIGNON: CurrentSite = {
  id: SITE_LEBIGNON_ID,
  slug: "lebignon",
  nom: "Lebignon",
  statut: "actif",
  fuseau: "Europe/Paris",
};

// STABLE tant que la V1a (single-site) : le site est lu une fois par
// requête. `cache()` de React déduplique l'appel entre AppHeader, les
// pages et les server actions.
export const getCurrentSite = cache(async function getCurrentSite(): Promise<CurrentSite> {
  // 1) Le middleware (src/proxy.ts) résout le site depuis le host et pose
  //    `x-site-id`. C'est le chemin nominal dès qu'un site est joignable
  //    par sous-domaine dédié.
  let siteId: string | null = null;
  try {
    const h = await headers();
    siteId = h.get("x-site-id");
  } catch {
    siteId = null;
  }

  // 2) V1a : fallback vers le site historique tant qu'un seul sous-domaine
  //    est configuré. Retiré en PR suivante quand /platform et le multi-
  //    domaine seront actifs.
  const id = siteId ?? SITE_LEBIGNON_ID;

  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("site")
      .select("id, slug, nom, statut, fuseau")
      .eq("id", id)
      .single<CurrentSite>();
    if (error || !data) return FALLBACK_LEBIGNON;
    return data;
  } catch {
    // Table `site` inexistante (pré-0043) ou erreur réseau : on donne le
    // fallback pour ne pas bloquer l'app.
    return FALLBACK_LEBIGNON;
  }
});
