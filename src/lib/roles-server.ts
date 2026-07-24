import { cache } from "react";
import { getServerClient } from "@/lib/supabase-server";
import { ROLES, ROLE_LABELS } from "@/lib/roles";

export type RoleOption = { code: string; libelle: string };

// Rôles personnalisés (table role_custom, migration 0042). Best-effort : si la
// table n'existe pas encore, on renvoie une liste vide et l'appli retombe sur
// les seuls rôles intégrés.
export const getCustomRoles = cache(async function getCustomRoles(): Promise<RoleOption[]> {
  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from("role_custom")
      .select("code, libelle")
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
