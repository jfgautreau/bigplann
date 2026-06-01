"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";

const PATH = "/admin/competences";
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "true" || fd.get(k) === "on";
const intOrNull = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === "" ? null : Number(v);
};
function done(): never {
  revalidatePath(PATH);
  redirect(PATH);
}

// Echelle de niveaux (0..4)
export async function saveEchelle(fd: FormData) {
  const supabase = await requireAdmin();
  for (let n = 0; n <= 4; n++) {
    const libelle = s(fd, `niveau_${n}`);
    if (libelle) {
      await supabase
        .from("competence_niveau_libelle")
        .upsert({ niveau: n, libelle }, { onConflict: "niveau" });
    }
  }
  done();
}

// Competences transverses / habilitations
export async function createCompetence(fd: FormData) {
  const supabase = await requireAdmin();
  const nom = s(fd, "nom");
  if (!nom) done();
  const a_recycler = bool(fd, "a_recycler");
  await supabase.from("competence").insert({
    nom,
    type: s(fd, "type") === "ACQUIS" ? "ACQUIS" : "NIVEAU",
    a_recycler,
    duree_validite_mois: a_recycler ? intOrNull(fd, "duree_validite_mois") : null,
  });
  done();
}

export async function updateCompetence(fd: FormData) {
  const supabase = await requireAdmin();
  const a_recycler = bool(fd, "a_recycler");
  await supabase
    .from("competence")
    .update({
      nom: s(fd, "nom"),
      type: s(fd, "type") === "ACQUIS" ? "ACQUIS" : "NIVEAU",
      a_recycler,
      duree_validite_mois: a_recycler ? intOrNull(fd, "duree_validite_mois") : null,
    })
    .eq("id", s(fd, "id"));
  done();
}

export async function toggleCompetence(fd: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("competence").update({ actif: bool(fd, "actif") }).eq("id", s(fd, "id"));
  done();
}
