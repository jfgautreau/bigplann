import { getAdminClient } from "@/lib/supabase-server";

// Lien de definition / reinitialisation de mot de passe.
//
// On GENERE le lien sans l'envoyer : le SMTP du projet n'est pas garanti (cf.
// OPERATIONS.md « Pas d'email requis », et le SMTP par defaut de Supabase est
// plafonne a quelques messages par heure vers les seules adresses de l'equipe).
// L'admin recupere donc l'URL et la transmet lui-meme. Rien ne se perd en spam,
// et la fonctionnalite marche meme sans serveur de mail.
//
// Le lien porte un jeton a usage unique : en REgenerer un invalide le precedent.
export async function genererLienMotDePasse(email: string, origin: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/auth/callback?next=/reset` },
  });
  if (error) throw new Error(error.message);
  const lien = data?.properties?.action_link;
  if (!lien) throw new Error("Lien non généré par Supabase.");
  return lien;
}

// Mot de passe de remplissage pour un compte cree par un admin : l'utilisateur
// ne le connaitra jamais et definira le sien via le lien. Il doit seulement
// satisfaire la politique (8 car., 3 classes) — cf. src/lib/password.ts.
export function motDePasseAleatoire(): string {
  const base = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  return `Aa1!${base.slice(0, 20)}`;
}
