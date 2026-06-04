import { cache } from "react";
import { getServerClient } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CurrentProfile = {
  authId: string;
  email: string;
  name: string;
  role: string;
};

// Profil applicatif de l'utilisateur connecte (ou null).
// - `getClaims()` verifie le JWT LOCALEMENT (cles asymetriques) sans appel reseau
//   au serveur Auth ; il retombe automatiquement sur getUser() si le projet est
//   encore en HS256 (aucune regression, gain effectif des l'activation des cles).
// - `cache()` deduplique l'appel sur toute la requete (requireModule + page).
export const getCurrentProfile = cache(async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await getServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) return null;

  const { data } = await supabase
    .from("app_user")
    .select("email, name, role")
    .eq("user_id", userId)
    .single<{ email: string; name: string; role: string }>();

  if (!data) return null;
  return { authId: userId, email: data.email, name: data.name, role: data.role };
});

// Garde serveur : exige un admin. Renvoie le client lie a la session
// (les ecritures passent par la RLS admin ; l'audit capture auth.uid()).
export async function requireAdmin(): Promise<SupabaseClient> {
  const supabase = await getServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) throw new Error("Non authentifie.");

  const { data } = await supabase
    .from("app_user")
    .select("role")
    .eq("user_id", userId)
    .single<{ role: string }>();
  if (data?.role !== "admin") throw new Error("Acces refuse (admin requis).");

  return supabase;
}
