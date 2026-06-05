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
    pointure: orNull(s(fd, "pointure")),
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
  // Champs niveau-personne uniquement. Le type de contrat et les dates sont
  // gérés via les périodes (table contrat_periode) et le reflet est synchronisé
  // côté API — on ne les touche donc pas ici pour ne pas écraser l'historique.
  await supabase
    .from("personne")
    .update({
      nom: s(fd, "nom"),
      prenom: s(fd, "prenom"),
      matricule: orNull(s(fd, "matricule")),
      equipe_id: orNull(s(fd, "equipe_id")),
      pointure: orNull(s(fd, "pointure")),
      commentaire: orNull(s(fd, "commentaire")),
    })
    .eq("id", id);
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

// RGPD : anonymisation (conserve l'historique de placement, retire l'identite).
export async function anonymiserPersonne(fd: FormData) {
  const supabase = await requireAdmin();
  const id = s(fd, "id");
  if (!id) return;
  const { data: p } = await supabase
    .from("personne")
    .select("matricule")
    .eq("id", id)
    .single<{ matricule: string | null }>();
  await supabase
    .from("personne")
    .update({
      nom: "Ex-collaborateur",
      prenom: p?.matricule ? `(${p.matricule})` : "",
      commentaire: null,
      agence_interim: null,
      statut: "PARTI",
      anonymise: true,
      anonymise_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/personnel");
  redirect("/personnel");
}

// RGPD : droit a l'oubli (suppression definitive + cascade).
export async function supprimerPersonne(fd: FormData) {
  const supabase = await requireAdmin();
  const id = s(fd, "id");
  if (!id) return;
  await supabase.from("personne").delete().eq("id", id);
  revalidatePath("/personnel");
  redirect("/personnel");
}
