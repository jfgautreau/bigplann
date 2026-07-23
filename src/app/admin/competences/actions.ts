"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleWrite } from "@/lib/permissions";
import { NIVEAUX_TAG } from "@/lib/refdata";
import { messageErreur, urlAvecErreur, type ErreurPg } from "@/lib/erreurs";

const PATH = "/admin/competences";
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "true" || fd.get(k) === "on";
const intOrNull = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === "" ? null : Number(v);
};

// `err` non nul -> message remonte a l'ecran via l'URL (cf. BandeauErreur).
function done(err: ErreurPg = null): never {
  const msg = messageErreur(err);
  revalidatePath(PATH);
  redirect(urlAvecErreur(PATH, msg));
}

// Echelle de niveaux (0..4)
export async function saveEchelle(fd: FormData) {
  const supabase = await requireModuleWrite("competences");
  for (let n = 0; n <= 4; n++) {
    const libelle = s(fd, `niveau_${n}`);
    if (libelle) {
      const { error } = await supabase
        .from("competence_niveau_libelle")
        .upsert({ niveau: n, libelle }, { onConflict: "niveau" });
      // On s'arrete au premier echec : poursuivre laisserait une echelle
      // partiellement enregistree sans que personne ne le sache.
      if (error) done(error);
    }
  }
  updateTag(NIVEAUX_TAG);
  done();
}

// Competences transverses / habilitations
export async function createCompetence(fd: FormData) {
  const supabase = await requireModuleWrite("competences");
  const nom = s(fd, "nom");
  if (!nom) done();
  const a_recycler = bool(fd, "a_recycler");
  const { error } = await supabase.from("competence").insert({
    nom,
    type: s(fd, "type") === "ACQUIS" ? "ACQUIS" : "NIVEAU",
    a_recycler,
    duree_validite_mois: a_recycler ? intOrNull(fd, "duree_validite_mois") : null,
  });
  done(error);
}

export async function updateCompetence(fd: FormData) {
  const supabase = await requireModuleWrite("competences");
  const a_recycler = bool(fd, "a_recycler");
  const { error } = await supabase
    .from("competence")
    .update({
      nom: s(fd, "nom"),
      type: s(fd, "type") === "ACQUIS" ? "ACQUIS" : "NIVEAU",
      a_recycler,
      duree_validite_mois: a_recycler ? intOrNull(fd, "duree_validite_mois") : null,
    })
    .eq("id", s(fd, "id"));
  done(error);
}

export async function toggleCompetence(fd: FormData) {
  const supabase = await requireModuleWrite("competences");
  const { error } = await supabase
    .from("competence")
    .update({ actif: bool(fd, "actif") })
    .eq("id", s(fd, "id"));
  done(error);
}
