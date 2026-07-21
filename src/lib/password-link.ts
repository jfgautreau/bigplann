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
//
// ⚠️ On n'utilise PAS `properties.action_link` renvoye par Supabase, mais on
// fabrique notre propre URL a partir de `properties.hashed_token`. L'action_link
// passe par /auth/v1/verify de Supabase, ce qui posait deux problemes :
//   1. son `redirect_to` doit figurer dans la liste blanche « Redirect URLs » du
//      projet ; sinon Supabase retombe silencieusement sur la Site URL (on
//      atterrissait sur /login) ;
//   2. il repond en flux implicite — jetons dans le FRAGMENT (#access_token=…) —
//      qu'une route serveur ne voit jamais. /auth/callback attend un `?code=`
//      (PKCE), impossible ici : le code_verifier PKCE nait dans le navigateur de
//      la personne qui lance la demande, or c'est l'admin qui genere le lien.
// En pointant directement sur /reset avec le token_hash, la page appelle
// verifyOtp() elle-meme : aucune configuration de liste blanche, et le meme lien
// marche en local comme en production.
export async function genererLienMotDePasse(email: string, origin: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw new Error(error.message);
  const jeton = data?.properties?.hashed_token;
  if (!jeton) throw new Error("Jeton non généré par Supabase.");
  return `${baseApplication(origin)}/reset?token_hash=${encodeURIComponent(jeton)}&type=recovery`;
}

// Adresse publique de l'application, sur laquelle pointe le lien transmis.
//
// L'origine de la requete ne convient pas seule : un admin qui travaille sur
// http://localhost:3000 fabriquerait des liens qui ne marchent que sur sa propre
// machine. On prefere donc, dans l'ordre :
//   1. NEXT_PUBLIC_SITE_URL — a poser si le domaine est personnalise ;
//   2. VERCEL_PROJECT_PRODUCTION_URL — le domaine de production, meme depuis un
//      deploiement de preview (variable systeme fournie par Vercel) ;
//   3. l'origine de la requete — cas du developpement local.
function baseApplication(origin: string): string {
  const explicite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicite) return explicite.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return origin.replace(/\/+$/, "");
}

// Mot de passe de remplissage pour un compte cree par un admin : l'utilisateur
// ne le connaitra jamais et definira le sien via le lien. Il doit seulement
// satisfaire la politique (8 car., 3 classes) — cf. src/lib/password.ts.
export function motDePasseAleatoire(): string {
  const base = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  return `Aa1!${base.slice(0, 20)}`;
}
