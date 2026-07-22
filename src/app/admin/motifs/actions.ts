"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleWrite } from "@/lib/permissions";

const PATH = "/admin/motifs";
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function done(): never {
  revalidatePath(PATH);
  redirect(PATH);
}

export async function createMotif(fd: FormData) {
  const supabase = await requireModuleWrite("motifs");
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
  const supabase = await requireModuleWrite("motifs");
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
  const supabase = await requireModuleWrite("motifs");
  await supabase
    .from("motif_absence")
    .update({ actif: fd.get("actif") === "true" })
    .eq("id", s(fd, "id"));
  done();
}

// ----- Agences d'interim -----
// Liste fermee alimentant le menu deroulant « Agence » des periodes de contrat
// (cf. src/app/personnel/PeriodesEditor.tsx). Desactiver plutot que supprimer :
// les periodes passees referencent l'agence par son NOM, en texte libre.

export async function createAgence(fd: FormData) {
  const supabase = await requireModuleWrite("motifs");
  const nom = s(fd, "nom");
  if (!nom) done();
  await supabase.from("agence_interim").insert({ nom });
  done();
}

export async function updateAgence(fd: FormData) {
  const supabase = await requireModuleWrite("motifs");
  const nom = s(fd, "nom");
  if (!nom) done();
  await supabase.from("agence_interim").update({ nom }).eq("id", s(fd, "id"));
  done();
}

export async function toggleAgence(fd: FormData) {
  const supabase = await requireModuleWrite("motifs");
  await supabase
    .from("agence_interim")
    .update({ actif: fd.get("actif") === "true" })
    .eq("id", s(fd, "id"));
  done();
}
