"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentProfile } from "@/lib/current-user";
import { getAdminClient } from "@/lib/supabase-server";
import { setImpersonation, clearImpersonation, getImpersonationPayload } from "@/lib/impersonation";
import { genererLienMotDePasse, motDePasseAleatoire } from "@/lib/password-link";
import { messageErreur } from "@/lib/erreurs";

// Server actions du back-office plateforme. Toutes revérifient que
// l'appelant est bien super_admin — défense en profondeur en plus du
// middleware et du layout.

async function requireSuperAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Non authentifié");
  if (!profile.estSuperAdmin) throw new Error("Accès refusé");
  return { profile, admin: getAdminClient() };
}

// Regex slug : lettres minuscules, chiffres, tirets. Blacklist les
// sous-domaines réservés (utilisés par la plateforme elle-même).
const SLUG_INTERDITS = new Set(["platform", "www", "api", "auth", "admin", "app"]);

function validerSlug(s: string): string | null {
  if (!s) return "Slug requis";
  if (!/^[a-z][a-z0-9-]{1,30}[a-z0-9]$/.test(s)) {
    return "Slug : 3–32 caractères, lettres/chiffres/tirets, commence par une lettre.";
  }
  if (SLUG_INTERDITS.has(s)) return `Slug « ${s} » réservé.`;
  return null;
}

// -------------------- Création d'un site --------------------
// Crée le site + son 1er compte admin local (email + role='admin' +
// site_id=<nouveau>). Renvoie un lien de mot de passe à transmettre.
// TODO PR 4 : copier les référentiels partagés (motifs groupe →
// override local si demandé, rôles groupe → visibles, etc.).
export async function createSite(fd: FormData): Promise<void> {
  const { admin } = await requireSuperAdmin();

  const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
  const nom = String(fd.get("nom") ?? "").trim();
  const emailAdmin = String(fd.get("email_admin") ?? "").trim().toLowerCase();
  const nomAdmin = String(fd.get("nom_admin") ?? "").trim();

  const slugErr = validerSlug(slug);
  if (slugErr) redirect(`/platform/nouveau?err=${encodeURIComponent(slugErr)}`);
  if (!nom) redirect(`/platform/nouveau?err=${encodeURIComponent("Nom du site requis")}`);
  if (!emailAdmin || !/^\S+@\S+\.\S+$/.test(emailAdmin)) {
    redirect(`/platform/nouveau?err=${encodeURIComponent("Email admin invalide")}`);
  }

  // 1) Crée le site
  const { data: site, error: siteErr } = await admin
    .from("site")
    .insert({ slug, nom, statut: "actif" })
    .select("id, slug, nom")
    .single<{ id: string; slug: string; nom: string }>();
  if (siteErr) redirect(`/platform/nouveau?err=${encodeURIComponent(messageErreur(siteErr) ?? "Erreur création site")}`);
  if (!site) redirect(`/platform/nouveau?err=${encodeURIComponent("Site non créé")}`);

  // 2) Crée le compte auth du 1er admin local
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: emailAdmin,
    password: motDePasseAleatoire(),
    email_confirm: true,
    user_metadata: { name: nomAdmin, site_id: site.id },
  });
  if (authErr) {
    // Rollback partiel : on essaie de supprimer le site créé pour ne
    // pas laisser un site sans admin. Si le rollback échoue lui aussi,
    // on le loggue mais on remonte l'erreur d'origine (createUser).
    const { error: rollbackErr } = await admin.from("site").delete().eq("id", site.id);
    if (rollbackErr) console.error("[createSite] rollback échec :", rollbackErr.message);
    redirect(`/platform/nouveau?err=${encodeURIComponent(`Auth: ${authErr.message}`)}`);
  }

  // 3) Le trigger handle_new_user a créé une ligne app_user via metadata.
  //    On force son role, son nom, son site et son statut actif.
  if (authData.user) {
    const { error: majErr } = await admin
      .from("app_user")
      .update({ role: "admin", name: nomAdmin, is_active: true, site_id: site.id })
      .eq("user_id", authData.user.id);
    if (majErr) {
      redirect(`/platform/nouveau?err=${encodeURIComponent(`Update: ${majErr.message}`)}`);
    }
  }

  // 4) Seed les données de base du site
  //    - parametre_affichage : fenêtre d'affichage TV (J-1 → J+4 par défaut)
  //    Les quarts sont globaux (table partagée) → pas besoin de seeder.
  //    Les motifs / types de contrat / rôles sont visibles via site_id IS NULL.
  //    Le référentiel local (ateliers, lignes, postes, équipes) est propre à
  //    chaque usine et sera saisi par l'admin local.
  const { error: seedErr } = await admin
    .from("parametre_affichage")
    .insert({ site_id: site.id, jours_avant: 1, jours_apres: 4 });
  if (seedErr) {
    console.error("[createSite] seed parametre_affichage :", seedErr.message);
    // Non bloquant : le site fonctionne avec les valeurs par défaut.
  }

  // 5) Génère le lien de mot de passe à transmettre
  let lien = "";
  try {
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host") ?? "localhost"}`;
    lien = await genererLienMotDePasse(emailAdmin, origin);
  } catch (e) {
    lien = `Erreur génération : ${e instanceof Error ? e.message : String(e)}`;
  }

  revalidatePath("/platform");
  redirect(`/platform/${site.id}?created=1&lien=${encodeURIComponent(lien)}`);
}

// -------------------- Suspendre / Réactiver / Archiver --------------------
export async function changerStatut(fd: FormData): Promise<void> {
  const { admin } = await requireSuperAdmin();
  const id = String(fd.get("id") ?? "");
  const statut = String(fd.get("statut") ?? "");
  if (!id) redirect("/platform");
  if (!["actif", "suspendu", "archive"].includes(statut)) {
    redirect(`/platform/${id}?err=${encodeURIComponent("Statut invalide")}`);
  }

  const { error } = await admin
    .from("site")
    .update({ statut })
    .eq("id", id);
  if (error) {
    redirect(`/platform/${id}?err=${encodeURIComponent(messageErreur(error) ?? "Erreur")}`);
  }

  revalidatePath("/platform");
  revalidatePath(`/platform/${id}`);
  redirect(`/platform/${id}?ok=1`);
}

// -------------------- Impersonation : entrer dans un site --------------------
export async function entrerDansLeSite(fd: FormData): Promise<void> {
  const { profile, admin } = await requireSuperAdmin();
  const id = String(fd.get("id") ?? "");
  const raison = String(fd.get("raison") ?? "").trim() || null;
  if (!id) redirect("/platform");

  // Vérifie que le site existe et est actif (pas d'impersonation sur
  // un site archivé — un archive doit être ré-activé avant d'y entrer).
  const { data: site } = await admin
    .from("site")
    .select("id, statut")
    .eq("id", id)
    .single<{ id: string; statut: string }>();
  if (!site) redirect(`/platform?err=${encodeURIComponent("Site introuvable")}`);
  if (site.statut === "archive") {
    redirect(`/platform/${id}?err=${encodeURIComponent("Impossible d'entrer dans un site archivé")}`);
  }

  // Trace l'entrée en mode support
  const h = await headers();
  const { data: audit, error: auditErr } = await admin
    .from("audit_impersonation")
    .insert({
      super_admin_id: profile.authId,
      site_id: id,
      ip: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? null,
      user_agent: h.get("user-agent") ?? null,
      raison,
    })
    .select("id")
    .single<{ id: string }>();
  if (auditErr || !audit) {
    redirect(`/platform/${id}?err=${encodeURIComponent(auditErr?.message ?? "audit KO")}`);
  }

  await setImpersonation(id, audit.id);
  redirect("/");
}

// -------------------- Sortir du mode support --------------------
export async function sortirDuMode(): Promise<void> {
  const { admin } = await requireSuperAdmin();
  const payload = await getImpersonationPayload();
  if (payload) {
    // Trace best-effort : si l'update échoue, on log mais on ne bloque
    // pas la sortie du mode (le cookie doit être effacé quoi qu'il arrive).
    const { error: traceErr } = await admin
      .from("audit_impersonation")
      .update({ exited_at: new Date().toISOString() })
      .eq("id", payload.auditId);
    if (traceErr) console.error("[sortirDuMode] trace fin échec :", traceErr.message);
  }
  await clearImpersonation();
  redirect("/platform");
}
