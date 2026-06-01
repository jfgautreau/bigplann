// Roles applicatifs (cf. cahier des charges section 3.1).
// Valeurs stockees en base (snake_case), libelles affiches en francais.

export const ROLES = [
  "admin",
  "resp_prod",
  "resp_planning",
  "chef_equipe",
  "ordonnancement",
  "rh",
  "direction",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  resp_prod: "Responsable production",
  resp_planning: "Responsable planning",
  chef_equipe: "Chef d'equipe",
  ordonnancement: "Ordonnancement",
  rh: "RH",
  direction: "Direction / Reporting",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleLabel(value: string): string {
  return isRole(value) ? ROLE_LABELS[value] : value;
}
