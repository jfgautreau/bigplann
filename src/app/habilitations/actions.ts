"use server";

import { revalidatePath } from "next/cache";
import { getServerClient, getAdminClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { canWriteModule } from "@/lib/permissions";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + months, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Enregistre une habilitation pour une personne. L'expiration est calculee
// a partir de la duree de validite de la competence. RLS = admin ou chef.
export async function saveHabilitation(fd: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Non authentifié.");
  const supabase = (await canWriteModule(profile.role, "habilitations")) ? getAdminClient() : await getServerClient();

  const personne_id = s(fd, "personne_id");
  const competence_id = s(fd, "competence_id");
  const date_obtention = s(fd, "date_obtention");
  const date_autorisation_conduite = s(fd, "date_autorisation_conduite") || null;
  if (!personne_id || !competence_id || !date_obtention) return;

  const { data: comp } = await supabase
    .from("competence")
    .select("duree_validite_mois, type")
    .eq("id", competence_id)
    .single<{ duree_validite_mois: number | null; type: string }>();

  const date_expiration = comp?.duree_validite_mois
    ? addMonths(date_obtention, comp.duree_validite_mois)
    : null;

  await supabase.from("personne_competence").upsert(
    {
      personne_id,
      competence_id,
      date_obtention,
      date_expiration,
      date_autorisation_conduite,
      acquis: comp?.type === "ACQUIS" ? true : null,
      auteur_app_user_id: profile.authId,
      date_maj: new Date().toISOString(),
    },
    { onConflict: "personne_id,competence_id" }
  );
  revalidatePath("/habilitations");
}

export async function deleteHabilitation(fd: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Non authentifié.");
  const supabase = (await canWriteModule(profile.role, "habilitations")) ? getAdminClient() : await getServerClient();
  await supabase.from("personne_competence").delete().eq("id", s(fd, "id"));
  revalidatePath("/habilitations");
}
