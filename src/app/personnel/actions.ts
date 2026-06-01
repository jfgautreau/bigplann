"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

type Contrat = "CDI" | "CDD" | "INTERIM";

function buildData(fd: FormData) {
  const type_contrat = (s(fd, "type_contrat") || "CDI") as Contrat;
  let matricule: string | null = orNull(s(fd, "matricule"));
  // Matricule auto-genere si interimaire sans matricule (cf. cahier 5.3).
  if (!matricule && type_contrat === "INTERIM") {
    matricule = `INT-${Date.now().toString(36).toUpperCase()}`;
  }
  return {
    matricule,
    nom: s(fd, "nom"),
    prenom: s(fd, "prenom"),
    equipe_id: orNull(s(fd, "equipe_id")),
    type_contrat,
    agence_interim: type_contrat === "INTERIM" ? orNull(s(fd, "agence_interim")) : null,
    date_debut: orNull(s(fd, "date_debut")),
    date_fin: orNull(s(fd, "date_fin")),
    commentaire: orNull(s(fd, "commentaire")),
  };
}

export async function createPersonne(fd: FormData) {
  const supabase = await requireAdmin();
  const data = buildData(fd);
  if (!data.nom || !data.prenom) return;
  await supabase.from("personne").insert(data);
  revalidatePath("/personnel");
}

export async function updatePersonne(fd: FormData) {
  const supabase = await requireAdmin();
  const id = s(fd, "id");
  if (!id) return;
  await supabase.from("personne").update(buildData(fd)).eq("id", id);
  revalidatePath("/personnel");
  redirect("/personnel");
}

export async function toggleStatut(fd: FormData) {
  const supabase = await requireAdmin();
  const id = s(fd, "id");
  const statut = s(fd, "statut") === "PARTI" ? "PARTI" : "ACTIF";
  await supabase.from("personne").update({ statut }).eq("id", id);
  revalidatePath("/personnel");
}
