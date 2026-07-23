"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { getAdminClient } from "@/lib/supabase-server";
import { canWriteModule } from "@/lib/permissions";
import { ROTATION_TAG } from "@/lib/refdata";
import { parseMonday, isoDate } from "@/lib/week";
import { messageErreur, urlAvecErreur, type ErreurPg } from "@/lib/erreurs";

const PATH = "/admin/equipes";
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// `err` non nul -> message remonte a l'ecran via l'URL (cf. BandeauErreur).
function done(err: ErreurPg = null): never {
  const msg = messageErreur(err);
  revalidatePath(PATH);
  redirect(urlAvecErreur(PATH, msg));
}

// Écriture équipes : admin OU droit "equipes: write" (client admin, contourne
// la RLS admin-only sur la table equipe).
async function requireEquipesWrite() {
  const profile = await getCurrentProfile();
  if (!profile || !(await canWriteModule(profile.role, "equipes"))) throw new Error("Accès refusé.");
  return getAdminClient();
}

// Écriture rotation / horaires des quarts : admin OU droit "ordonnancement: write"
// (client admin, RLS quart / rotation_reference admin-only).
async function requireOrdoWrite() {
  const profile = await getCurrentProfile();
  if (!profile || !(await canWriteModule(profile.role, "ordonnancement"))) throw new Error("Accès refusé.");
  return getAdminClient();
}

export async function createEquipe(fd: FormData) {
  const supabase = await requireEquipesWrite();
  const nom = s(fd, "nom");
  if (!nom) done();
  const { error } = await supabase.from("equipe").insert({ nom, couleur: s(fd, "couleur") || "#64748b" });
  done(error);
}
export async function renameEquipe(fd: FormData) {
  const supabase = await requireEquipesWrite();
  const { error } = await supabase
    .from("equipe")
    .update({
      nom: s(fd, "nom"),
      couleur: s(fd, "couleur") || "#64748b",
      quart_fixe: s(fd, "quart_fixe") || null,
    })
    .eq("id", s(fd, "id"));
  done(error);
}
export async function toggleEquipe(fd: FormData) {
  const supabase = await requireEquipesWrite();
  const { error } = await supabase
    .from("equipe")
    .update({ actif: fd.get("actif") === "true" })
    .eq("id", s(fd, "id"));
  done(error);
}
export async function addChef(fd: FormData) {
  const supabase = await requireEquipesWrite();
  const equipe_id = s(fd, "equipe_id");
  const app_user_id = s(fd, "app_user_id");
  if (!equipe_id || !app_user_id) done();
  const { error } = await supabase.from("equipe_chef").insert({ equipe_id, app_user_id });
  done(error);
}
export async function removeChef(fd: FormData) {
  const supabase = await requireEquipesWrite();
  const { error } = await supabase.from("equipe_chef").delete().eq("id", s(fd, "id"));
  done(error);
}

// --- Rotation des quarts (fusionnee dans la page Equipes) ---
const VALID_QUART = ["journee", "matin", "apres_midi", "nuit"];

// Horaires des quarts (libelle + debut/fin).
export async function saveQuartHoraires(fd: FormData) {
  const supabase = await requireOrdoWrite();
  for (const code of VALID_QUART) {
    const libelle = s(fd, `lib_${code}`);
    const debut = s(fd, `debut_${code}`) || null;
    const fin = s(fd, `fin_${code}`) || null;
    if (libelle) {
      const { error } = await supabase.from("quart").update({ libelle, debut, fin }).eq("code", code);
      if (error) done(error);
    }
  }
  done();
}

// Enregistre (ou remplace) la reference de rotation d'une semaine : le quart de
// chaque equipe tournante ce lundi-la. La date saisie est ramenee au lundi. Les
// champs "quart_<equipe_id>" absents ou vides retirent l'equipe de la reference.
//
// ⚠️ On reecrit tout le bloc de la semaine (effacement puis reinsertion) pour
// refleter aussi les equipes retirees. Ces deux operations passent par la
// fonction SQL `set_rotation_reference` (migration 0037) : elles sont ainsi
// INDIVISIBLES. Auparavant, un echec de la reinsertion laissait la semaine vide
// sans le signaler — et la rotation des semaines suivantes etant *calculee* a
// partir de la reference la plus recente, tout le calendrier posterieur se
// decalait en silence.
export async function saveRotationReference(fd: FormData) {
  const supabase = await requireOrdoWrite();
  const semaine = isoDate(parseMonday(s(fd, "semaine")));

  const rows: { equipe_id: string; quart_code: string }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("quart_")) continue;
    const equipe_id = k.slice("quart_".length);
    const quart = String(v);
    if (equipe_id && VALID_QUART.includes(quart)) rows.push({ equipe_id, quart_code: quart });
  }

  const { error } = await supabase.rpc("set_rotation_reference", { p_semaine: semaine, p_rows: rows });
  if (!error) updateTag(ROTATION_TAG);
  done(error);
}

// Supprime entierement la reference d'une semaine (un bloc vide efface tout).
export async function deleteRotationReference(fd: FormData) {
  const supabase = await requireOrdoWrite();
  const semaine = s(fd, "semaine");
  if (!semaine) done();
  const { error } = await supabase.rpc("set_rotation_reference", { p_semaine: semaine, p_rows: [] });
  if (!error) updateTag(ROTATION_TAG);
  done(error);
}
