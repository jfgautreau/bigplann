import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultQuartActif, dowMon } from "@/lib/week";

// Semaine type : defaut "auto-load" des quarts actifs, parametrable.
// Cle = `${quart_code}:${jour_semaine}` (jour_semaine 0=lundi..6=dimanche).
export type SemaineType = Record<string, boolean>;

// Profils de semaine type (0028). Best-effort : [] si table absente.
export type Profil = { id: string; nom: string; par_defaut: boolean };
export async function getProfils(supabase: SupabaseClient): Promise<Profil[]> {
  try {
    const { data } = await supabase
      .from("semaine_type_profil")
      .select("id, nom, par_defaut")
      .order("par_defaut", { ascending: false })
      .order("nom")
      .returns<Profil[]>();
    return data ?? [];
  } catch {
    return [];
  }
}
export async function getDefaultProfilId(supabase: SupabaseClient): Promise<string | null> {
  const profils = await getProfils(supabase);
  return (profils.find((p) => p.par_defaut) ?? profils[0])?.id ?? null;
}

// Charge la semaine type d'un profil (defaut si non precise). Best-effort : {}
// si table/migration absente -> on retombe sur le defaut code en dur.
export async function getSemaineType(supabase: SupabaseClient, profilId?: string): Promise<SemaineType> {
  try {
    const pid = profilId ?? (await getDefaultProfilId(supabase));
    if (!pid) return {};
    const { data } = await supabase
      .from("semaine_type_quart")
      .select("quart_code, jour_semaine, actif")
      .eq("profil_id", pid)
      .returns<{ quart_code: string; jour_semaine: number; actif: boolean }[]>();
    const m: SemaineType = {};
    for (const r of data ?? []) m[`${r.quart_code}:${r.jour_semaine}`] = r.actif;
    return m;
  } catch {
    return {};
  }
}

// Quart actif par defaut pour (jour, quart) selon la semaine type ;
// si la cle est absente, on retombe sur le defaut historique code en dur.
export function typeQuartActif(type: SemaineType, iso: string, code: string): boolean {
  const k = `${code}:${dowMon(iso)}`;
  return k in type ? type[k] : defaultQuartActif(iso, code);
}

// Ouverture des lignes par defaut (gabarit).
// Cle = `${quart_code}:${ligne_id}:${jour_semaine}`. Absence = ouvert (true).
export type SemaineOuverture = Record<string, boolean>;

export async function getSemaineOuverture(supabase: SupabaseClient, profilId?: string): Promise<SemaineOuverture> {
  try {
    const pid = profilId ?? (await getDefaultProfilId(supabase));
    if (!pid) return {};
    const { data } = await supabase
      .from("semaine_type_ouverture")
      .select("quart_code, ligne_id, jour_semaine, ouverte")
      .eq("profil_id", pid)
      .returns<{ quart_code: string; ligne_id: string; jour_semaine: number; ouverte: boolean }[]>();
    const m: SemaineOuverture = {};
    for (const r of data ?? []) m[`${r.quart_code}:${r.ligne_id}:${r.jour_semaine}`] = r.ouverte;
    return m;
  } catch {
    return {};
  }
}

// Ligne ouverte par defaut pour (jour, quart, ligne) ; absente = ouvert.
export function typeLigneOuverte(
  ouv: SemaineOuverture,
  iso: string,
  code: string,
  ligneId: string
): boolean {
  const k = `${code}:${ligneId}:${dowMon(iso)}`;
  return k in ouv ? ouv[k] : true;
}
