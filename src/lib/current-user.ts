import { cache } from "react";
import { getServerClient } from "@/lib/supabase-server";

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
    .select("email, name, role, is_active")
    .eq("user_id", userId)
    .single<{ email: string; name: string; role: string; is_active: boolean }>();

  // `is_active` etait lu par la RLS (is_admin / has_role) mais JAMAIS par
  // l'application : un compte desactive directement en base gardait toute sa
  // navigation. La desactivation via /admin/users bannit aussi le compte cote
  // Auth, ce qui masquait le trou. On ferme ici, a la source du profil : plus de
  // profil, donc redirection vers /login par requireModule.
  if (!data || !data.is_active) return null;
  return { authId: userId, email: data.email, name: data.name, role: data.role };
});

