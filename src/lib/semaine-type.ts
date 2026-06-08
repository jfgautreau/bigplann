import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultQuartActif, dowMon } from "@/lib/week";

// Semaine type : defaut "auto-load" des quarts actifs, parametrable.
// Cle = `${quart_code}:${jour_semaine}` (jour_semaine 0=lundi..6=dimanche).
export type SemaineType = Record<string, boolean>;

// Charge la semaine type (best-effort : {} si table absente / migration 0018
// non encore appliquee -> on retombe sur le defaut code en dur).
export async function getSemaineType(supabase: SupabaseClient): Promise<SemaineType> {
  try {
    const { data } = await supabase
      .from("semaine_type_quart")
      .select("quart_code, jour_semaine, actif")
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
