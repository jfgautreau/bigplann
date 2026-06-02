"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import { isRole } from "@/lib/roles";

// Modifie le role d'un utilisateur existant. Admin uniquement.
// On interdit de changer son propre role (evite un auto-verrouillage).
export async function updateUserRole(fd: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Acces refuse.");

  const user_id = String(fd.get("user_id") ?? "");
  const role = String(fd.get("role") ?? "");
  if (!user_id || !isRole(role)) return;
  if (user_id === profile.authId) return;

  const supabase = await getServerClient();
  await supabase.from("app_user").update({ role }).eq("user_id", user_id);
  revalidatePath("/admin/users");
}
