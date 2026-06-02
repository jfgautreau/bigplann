"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";

export async function saveHoraires(fd: FormData) {
  const supabase = await requireAdmin();
  const equipe_id = String(fd.get("equipe_id") ?? "");
  const ligne_id = String(fd.get("ligne_id") ?? "");
  const posteIds = String(fd.get("poste_ids") ?? "").split(",").filter(Boolean);
  if (!equipe_id || posteIds.length === 0) return;

  const rows: { poste_id: string; equipe_id: string; jour: number; debut: string | null; fin: string | null }[] = [];
  for (const pid of posteIds) {
    for (let j = 0; j < 7; j++) {
      const debut = String(fd.get(`debut_${pid}_${j}`) ?? "").trim();
      const fin = String(fd.get(`fin_${pid}_${j}`) ?? "").trim();
      if (debut || fin) rows.push({ poste_id: pid, equipe_id, jour: j, debut: debut || null, fin: fin || null });
    }
  }

  // Remplace tout pour ces postes et cette equipe.
  await supabase.from("horaire_poste").delete().eq("equipe_id", equipe_id).in("poste_id", posteIds);
  if (rows.length) await supabase.from("horaire_poste").insert(rows);

  revalidatePath("/admin/horaires");
  redirect(`/admin/horaires?ligne=${ligne_id}&equipe=${equipe_id}`);
}
