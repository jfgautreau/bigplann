import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { ROLES, type Role } from "@/lib/roles";

export type Niveau = "none" | "read" | "write";

// Modules de l'application. `admin: true` = page de gestion (menu visible si
// droit d'ecriture) ; sinon module operationnel (menu visible des la lecture).
export const MODULES: { key: string; label: string; href: string; admin: boolean }[] = [
  { key: "personnel", label: "Personnel", href: "/personnel", admin: false },
  { key: "matrice", label: "Matrice", href: "/matrice", admin: false },
  { key: "habilitations", label: "Habilitations", href: "/habilitations", admin: false },
  { key: "planning", label: "Planning", href: "/planning", admin: false },
  { key: "ordonnancement", label: "Ordonnancement", href: "/ordonnancement", admin: true },
  { key: "bilans", label: "Bilans", href: "/bilans", admin: false },
  { key: "journal", label: "Journal", href: "/journal", admin: false },
  { key: "affichage", label: "Affichage", href: "/affichage", admin: false },
  { key: "referentiel", label: "Référentiel", href: "/admin/referentiel", admin: true },
  { key: "equipes", label: "Équipes", href: "/admin/equipes", admin: true },
  { key: "competences", label: "Compétences", href: "/admin/competences", admin: true },
  { key: "habilitations_param", label: "Param. Habilitation", href: "/admin/habilitations-param", admin: true },
  { key: "motifs", label: "Motifs", href: "/admin/motifs", admin: true },
  { key: "horaires", label: "Horaires", href: "/admin/horaires", admin: true },
  { key: "utilisateurs", label: "Utilisateurs", href: "/admin/users", admin: true },
  { key: "rgpd", label: "RGPD", href: "/admin/rgpd", admin: true },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
export type Perms = Record<string, Niveau>;

const NONE: Perms = Object.fromEntries(MODULE_KEYS.map((k) => [k, "none"]));

// Droits par defaut (utilises tant qu'aucune ligne ne les surcharge en base).
export function defaultsFor(role: string): Perms {
  if (role === "admin") return Object.fromEntries(MODULE_KEYS.map((k) => [k, "write"]));
  const p: Perms = { ...NONE };
  const set = (o: Partial<Perms>) => Object.assign(p, o);
  switch (role) {
    case "chef_equipe":
      set({ personnel: "read", bilans: "read", matrice: "write", habilitations: "write", planning: "write" });
      break;
    case "ordo":
      set({ personnel: "read", matrice: "read", habilitations: "read", planning: "read", bilans: "read", ordonnancement: "write" });
      break;
    case "rh":
      set({ personnel: "read", matrice: "read", habilitations: "read", planning: "read", bilans: "read" });
      break;
    case "codir":
      set({ personnel: "read", matrice: "read", habilitations: "read", planning: "read", ordonnancement: "read", bilans: "read", journal: "read" });
      break;
    case "planning":
      set({ personnel: "read", matrice: "read", habilitations: "read", planning: "read", ordonnancement: "read", bilans: "read" });
      break;
  }
  return p;
}

export function canRead(p: Perms, mod: string): boolean {
  return p[mod] === "read" || p[mod] === "write";
}
export function canWrite(p: Perms, mod: string): boolean {
  return p[mod] === "write";
}

// Droit d'écriture d'un module pour un rôle (matrice des droits). Sert aux API
// pour autoriser l'édition selon les droits configurés (client admin), en plus
// des chemins RLS existants (admin / chef d'équipe / rôle ordo).
export async function canWriteModule(role: string, mod: string): Promise<boolean> {
  return canWrite(await getPermissions(role), mod);
}

// Droits effectifs d'un role = defauts surchargés par la table role_permission.
// `cache()` : dedupe la requete role_permission par role sur toute la requete HTTP.
export const getPermissions = cache(async function getPermissions(role: string): Promise<Perms> {
  const p = defaultsFor(role);
  try {
    const supabase = await getServerClient();
    const { data } = await supabase
      .from("role_permission")
      .select("module, niveau")
      .eq("role", role)
      .returns<{ module: string; niveau: Niveau }[]>();
    for (const r of data ?? []) if (r.module in p) p[r.module] = r.niveau;
  } catch {
    // table absente ou erreur : on garde les defauts
  }
  return p;
});

// Tous les droits effectifs (pour l'editeur de la matrice).
export async function getAllPermissions(): Promise<Record<string, Perms>> {
  const all: Record<string, Perms> = {};
  for (const r of ROLES) all[r] = defaultsFor(r);
  try {
    const supabase = await getServerClient();
    const { data } = await supabase
      .from("role_permission")
      .select("role, module, niveau")
      .returns<{ role: string; module: string; niveau: Niveau }[]>();
    for (const row of data ?? []) {
      if (all[row.role] && row.module in all[row.role]) all[row.role][row.module] = row.niveau;
    }
  } catch {
    /* defauts */
  }
  return all;
}

export type { Role };

// Garde d'acces a un module pour une page. Redirige si droit insuffisant.
export async function requireModule(module: string, level: "read" | "write") {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const perms = await getPermissions(profile.role);
  const ok = level === "write" ? canWrite(perms, module) : canRead(perms, module);
  if (!ok) redirect("/planning");
  return { profile, perms };
}
