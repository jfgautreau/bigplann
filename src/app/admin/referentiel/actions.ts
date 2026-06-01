"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";

const PATH = "/admin/referentiel";

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}
function bool(fd: FormData, k: string): boolean {
  return fd.get(k) === "true" || fd.get(k) === "on";
}
function intOrNull(fd: FormData, k: string): number | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : Number(v);
}
function done(): never {
  revalidatePath(PATH);
  redirect(PATH); // revient en lecture seule (purge le ?edit)
}

// ---------- Atelier ----------
export async function createAtelier(fd: FormData) {
  const supabase = await requireAdmin();
  const nom = str(fd, "nom");
  if (nom) await supabase.from("atelier").insert({ nom });
  done();
}
export async function renameAtelier(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("atelier").update({ nom: str(fd, "nom") }).eq("id", str(fd, "id"));
  done();
}
export async function toggleAtelier(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("atelier").update({ actif: bool(fd, "actif") }).eq("id", str(fd, "id"));
  done();
}

// ---------- Ligne ----------
export async function createLigne(fd: FormData) {
  const supabase = await requireAdmin();
  const nom = str(fd, "nom");
  const atelier_id = str(fd, "atelier_id");
  if (nom && atelier_id) await supabase.from("ligne").insert({ nom, atelier_id });
  done();
}
export async function renameLigne(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("ligne").update({ nom: str(fd, "nom") }).eq("id", str(fd, "id"));
  done();
}
export async function toggleLigne(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("ligne").update({ actif: bool(fd, "actif") }).eq("id", str(fd, "id"));
  done();
}

// ---------- Poste ----------
export async function createPoste(fd: FormData) {
  const supabase = await requireAdmin();
  const ligne_id = str(fd, "ligne_id");
  const nom = str(fd, "nom");
  if (ligne_id && nom) {
    await supabase.from("poste").insert({
      ligne_id,
      nom,
      nom_court: str(fd, "nom_court").slice(0, 6) || null,
      est_conducteur: bool(fd, "est_conducteur"),
      effectif_requis: Number(str(fd, "effectif_requis") || "0"),
      difficulte_formation: intOrNull(fd, "difficulte_formation"),
      niveau_min_requis: Number(str(fd, "niveau_min_requis") || "0"),
    });
  }
  done();
}
export async function updatePoste(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase
    .from("poste")
    .update({
      nom: str(fd, "nom"),
      nom_court: str(fd, "nom_court").slice(0, 6) || null,
      est_conducteur: bool(fd, "est_conducteur"),
      effectif_requis: Number(str(fd, "effectif_requis") || "0"),
      difficulte_formation: intOrNull(fd, "difficulte_formation"),
      niveau_min_requis: Number(str(fd, "niveau_min_requis") || "0"),
    })
    .eq("id", str(fd, "id"));
  done();
}
export async function togglePoste(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("poste").update({ actif: bool(fd, "actif") }).eq("id", str(fd, "id"));
  done();
}
