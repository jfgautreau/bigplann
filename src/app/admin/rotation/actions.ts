"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWriteModule } from "@/lib/permissions";
import { ROTATION_TAG } from "@/lib/refdata";
import { parseMonday, isoDate } from "@/lib/week";

// admin, rôle ordo, ou droit "ordonnancement: write". Client admin car la RLS
// des tables quart / rotation_reference est admin/ordo (bloquait sinon les autres).
async function requireOrdoAdmin() {
  const profile = await getCurrentProfile();
  const ok = profile && (profile.role === "admin" || profile.role === "ordo" || (await canWriteModule(profile.role, "ordonnancement")));
  if (!ok) throw new Error("Accès refusé.");
  return getAdminClient();
}

const VALID = ["journee", "matin", "apres_midi", "nuit"];
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Horaires des quarts (libelle + debut/fin).
export async function saveQuartHoraires(fd: FormData) {
  const supabase = await requireOrdoAdmin();
  for (const code of VALID) {
    const libelle = s(fd, `lib_${code}`);
    const debut = s(fd, `debut_${code}`) || null;
    const fin = s(fd, `fin_${code}`) || null;
    if (libelle) {
      await supabase.from("quart").update({ libelle, debut, fin }).eq("code", code);
    }
  }
  revalidatePath("/admin/rotation");
}

// Enregistre (ou remplace) la reference de rotation d'une semaine : le quart de
// chaque equipe tournante ce lundi-la. La date saisie est ramenee au lundi. Les
// champs "quart_<equipe_id>" absents ou vides retirent l'equipe de la reference.
export async function saveRotationReference(fd: FormData) {
  const supabase = await requireOrdoAdmin();
  const semaine = isoDate(parseMonday(s(fd, "semaine")));

  const rows: { semaine: string; equipe_id: string; quart_code: string }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("quart_")) continue;
    const equipe_id = k.slice("quart_".length);
    const quart = String(v);
    if (equipe_id && VALID.includes(quart)) rows.push({ semaine, equipe_id, quart_code: quart });
  }

  // On reecrit tout le bloc de la semaine (delete puis insert) pour refleter aussi
  // les equipes retirees.
  await supabase.from("rotation_reference").delete().eq("semaine", semaine);
  if (rows.length) await supabase.from("rotation_reference").insert(rows);

  updateTag(ROTATION_TAG);
  revalidatePath("/admin/rotation");
}

// Supprime entierement la reference d'une semaine.
export async function deleteRotationReference(fd: FormData) {
  const supabase = await requireOrdoAdmin();
  const semaine = s(fd, "semaine");
  if (semaine) {
    await supabase.from("rotation_reference").delete().eq("semaine", semaine);
    updateTag(ROTATION_TAG);
  }
  revalidatePath("/admin/rotation");
}
