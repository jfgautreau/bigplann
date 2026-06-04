"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";

export async function saveHoraires(fd: FormData) {
  const supabase = await requireAdmin();
  const ligne_id = String(fd.get("ligne_id") ?? "");
  const posteIds = String(fd.get("poste_ids") ?? "").split(",").filter(Boolean);
  const quartCodes = String(fd.get("quart_codes") ?? "").split(",").filter(Boolean);
  if (posteIds.length === 0 || quartCodes.length === 0) return;

  const rows: { poste_id: string; quart_code: string; jour: number; debut: string | null; fin: string | null }[] = [];
  for (const pid of posteIds) {
    for (const q of quartCodes) {
      for (let j = 0; j < 7; j++) {
        const debut = String(fd.get(`debut_${pid}_${q}_${j}`) ?? "").trim();
        const fin = String(fd.get(`fin_${pid}_${q}_${j}`) ?? "").trim();
        if (debut || fin) rows.push({ poste_id: pid, quart_code: q, jour: j, debut: debut || null, fin: fin || null });
      }
    }
  }

  // Remplace tout pour ces postes (tous quarts).
  await supabase.from("horaire_poste").delete().in("poste_id", posteIds);
  if (rows.length) await supabase.from("horaire_poste").insert(rows);

  revalidatePath("/admin/horaires");
  redirect(`/admin/horaires?ligne=${ligne_id}`);
}
