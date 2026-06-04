"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";

async function requireOrdoAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "ordo")) {
    throw new Error("Accès refusé.");
  }
  return getServerClient();
}

const VALID = ["matin", "apres_midi", "nuit"];

// Horaires des quarts (libelle + debut/fin).
export async function saveQuartHoraires(fd: FormData) {
  const supabase = await requireOrdoAdmin();
  for (const code of VALID) {
    const libelle = String(fd.get(`lib_${code}`) ?? "").trim();
    const debut = String(fd.get(`debut_${code}`) ?? "").trim() || null;
    const fin = String(fd.get(`fin_${code}`) ?? "").trim() || null;
    if (libelle) {
      await supabase.from("quart").update({ libelle, debut, fin }).eq("code", code);
    }
  }
  revalidatePath("/admin/rotation");
}

// Rotation : equipe x semaine -> quart. Cle de champ "cell|<equipe>|<semaine>".
export async function saveRotation(fd: FormData) {
  const supabase = await requireOrdoAdmin();
  const ups: { equipe_id: string; semaine: string; quart_code: string }[] = [];
  const dels: { equipe_id: string; semaine: string }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("cell|")) continue;
    const [, equipe_id, semaine] = k.split("|");
    const quart = String(v);
    if (VALID.includes(quart)) ups.push({ equipe_id, semaine, quart_code: quart });
    else dels.push({ equipe_id, semaine });
  }
  if (ups.length) await supabase.from("equipe_quart_semaine").upsert(ups, { onConflict: "equipe_id,semaine" });
  for (const d of dels) {
    await supabase.from("equipe_quart_semaine").delete().eq("equipe_id", d.equipe_id).eq("semaine", d.semaine);
  }
  revalidatePath("/admin/rotation");
}
