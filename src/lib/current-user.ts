import { getServerClient } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CurrentProfile = {
  authId: string;
  email: string;
  name: string;
  role: string;
};

// Profil applicatif de l'utilisateur connecte (ou null).
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("app_user")
    .select("email, name, role")
    .eq("user_id", user.id)
    .single<{ email: string; name: string; role: string }>();

  if (!data) return null;
  return { authId: user.id, email: data.email, name: data.name, role: data.role };
}

// Garde serveur : exige un admin. Renvoie le client lie a la session
// (les ecritures passent par la RLS admin ; l'audit capture auth.uid()).
export async function requireAdmin(): Promise<SupabaseClient> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifie.");

  const { data } = await supabase
    .from("app_user")
    .select("role")
    .eq("user_id", user.id)
    .single<{ role: string }>();
  if (data?.role !== "admin") throw new Error("Acces refuse (admin requis).");

  return supabase;
}
