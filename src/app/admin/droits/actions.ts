"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { MODULE_KEYS, type Niveau } from "@/lib/permissions";
import { ROLES } from "@/lib/roles";

const VALID: Niveau[] = ["none", "read", "write"];

export async function saveDroits(fd: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Acces refuse.");
  const supabase = await getServerClient();

  const rows: { role: string; module: string; niveau: Niveau }[] = [];
  for (const role of ROLES) {
    for (const module of MODULE_KEYS) {
      // L'admin garde toujours tous les droits.
      if (role === "admin") {
        rows.push({ role, module, niveau: "write" });
        continue;
      }
      const v = String(fd.get(`cell_${role}_${module}`) ?? "none") as Niveau;
      rows.push({ role, module, niveau: VALID.includes(v) ? v : "none" });
    }
  }
  await supabase.from("role_permission").upsert(rows, { onConflict: "role,module" });
  revalidatePath("/admin/droits");
}
