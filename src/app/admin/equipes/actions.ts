"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/current-user";

const PATH = "/admin/equipes";
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createEquipe(fd: FormData) {
  const supabase = await requireAdmin();
  const nom = s(fd, "nom");
  if (nom) await supabase.from("equipe").insert({ nom, couleur: s(fd, "couleur") || "#64748b" });
  revalidatePath(PATH);
}
export async function renameEquipe(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase
    .from("equipe")
    .update({
      nom: s(fd, "nom"),
      couleur: s(fd, "couleur") || "#64748b",
      quart_fixe: s(fd, "quart_fixe") || null,
    })
    .eq("id", s(fd, "id"));
  revalidatePath(PATH);
}
export async function toggleEquipe(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase
    .from("equipe")
    .update({ actif: fd.get("actif") === "true" })
    .eq("id", s(fd, "id"));
  revalidatePath(PATH);
}
export async function addChef(fd: FormData) {
  const supabase = await requireAdmin();
  const equipe_id = s(fd, "equipe_id");
  const app_user_id = s(fd, "app_user_id");
  if (equipe_id && app_user_id) {
    await supabase
      .from("equipe_chef")
      .insert({ equipe_id, app_user_id })
      .select();
  }
  revalidatePath(PATH);
}
export async function removeChef(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("equipe_chef").delete().eq("id", s(fd, "id"));
  revalidatePath(PATH);
}
