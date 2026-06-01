// Roles applicatifs (liste officielle).
// Valeurs stockees en base (snake_case / court), libelles affiches en francais.
// Ordre = ordre d'affichage dans les listes deroulantes.

export const ROLES = [
  "codir",
  "chef_equipe",
  "ordo",
  "rh",
  "admin",
  "planning",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  codir: "CODIR",
  chef_equipe: "Chef d'équipe",
  ordo: "Ordo",
  rh: "RH",
  admin: "Admin",
  planning: "Planning",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleLabel(value: string): string {
  return isRole(value) ? ROLE_LABELS[value] : value;
}
