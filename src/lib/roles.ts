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

// Code technique d'un role personnalise, derive de son libelle : minuscules,
// sans accents, mots relies par « _ ». Sert de cle primaire dans role_custom et
// de valeur stockee dans app_user.role. « Superviseur Nuit » -> « superviseur_nuit ».
export function slugifyRole(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
