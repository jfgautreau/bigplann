"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";

const PATH = "/admin/motifs";
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function done(): never {
  revalidatePath(PATH);
  redirect(PATH);
}

export async function createMotif(fd: FormData) {
  const supabase = await requireAdmin();
  const libelle = s(fd, "libelle");
  const code_court = s(fd, "code_court");
  if (!libelle || !code_court) done();
  await supabase.from("motif_absence").insert({
    libelle,
    code_court,
    couleur: s(fd, "couleur") || "#e5e7eb",
  });
  done();
}

export async function updateMotif(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase
    .from("motif_absence")
    .update({
      libelle: s(fd, "libelle"),
      code_court: s(fd, "code_court"),
      couleur: s(fd, "couleur") || "#e5e7eb",
    })
    .eq("id", s(fd, "id"));
  done();
}

export async function toggleMotif(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase
    .from("motif_absence")
    .update({ actif: fd.get("actif") === "true" })
    .eq("id", s(fd, "id"));
  done();
}
