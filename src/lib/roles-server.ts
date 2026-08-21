import { cache } from "react";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentSite } from "@/lib/current-site";
import { ROLES, ROLE_LABELS } from "@/lib/roles";

export type RoleOption = { code: string; libelle: string };

// Rôles personnalisés (table role_custom, migration 0042). Depuis la 0053,
// `role_custom.site_id` est NOT NULL : chaque site a ses propres rôles
// custom. Ici on lit uniquement ceux du site courant.
//
// Best-effort : si la table n'existe pas encore (fenêtre pré-0042), on
// renvoie une liste vide et l'appli retombe sur les seuls rôles intégrés.
export const getCustomRoles = cache(async function getCustomRoles(): Promise<RoleOption[]> {
  try {
    const [supabase, site] = await Promise.all([getServerClient(), getCurrentSite()]);
    const { data, error } = await supabase
      .from("role_custom")
      .select("code, libelle")
      .eq("site_id", site.id)
      .order("libelle")
      .returns<RoleOption[]>();
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
});

// Tous les rôles assignables : les intégrés (dans l'ordre du code) puis les
// personnalisés. Un même code n'apparaît qu'une fois (les intégrés priment).
export async function getAllRoles(): Promise<RoleOption[]> {
  const integres: RoleOption[] = ROLES.map((r) => ({ code: r, libelle: ROLE_LABELS[r] }));
  const customs = (await getCustomRoles()).filter((c) => !ROLES.includes(c.code as (typeof ROLES)[number]));
  return [...integres, ...customs];
}

// Map code -> libellé, pour l'affichage (couvre intégrés + personnalisés).
export async function getRoleLabelMap(): Promise<Record<string, string>> {
  const all = await getAllRoles();
  return Object.fromEntries(all.map((r) => [r.code, r.libelle]));
}
