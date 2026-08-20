import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

// Cookie signé qui porte l'état d'impersonation du super_admin.
// Utilisé par :
//   - Le middleware (src/proxy.ts) qui lit la valeur, valide la signature
//     et pose un header `x-impersonate-site` sur toutes les requêtes.
//   - getCurrentSite() qui préfère le header sur app_user.site_id.
//   - AppHeader qui affiche un bandeau rouge tant que le cookie est actif.
//   - La fonction SQL current_site_id() (migration 0048) qui lit le header
//     via PostgREST — MAIS seulement si l'appelant est super_admin.
//
// La signature HMAC-SHA256 empêche un client de forger un cookie et
// d'entrer arbitrairement dans un site sans passer par /platform.

export const IMPERSONATE_COOKIE = "polaris-impersonate";
export const IMPERSONATE_HEADER = "x-impersonate-site";

// TTL par défaut : 60 min. Passé ce délai, le middleware efface le cookie
// et le super_admin doit re-cliquer « Entrer » depuis /platform.
export const IMPERSONATE_TTL_MS = 60 * 60 * 1000;

type ImpersonationPayload = {
  siteId: string;
  auditId: string;      // ligne dans audit_impersonation, pour tracer la fin
  expiresAt: number;    // ms epoch
};

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    ?? "";
  if (!s) throw new Error("Aucune clé pour signer le cookie d'impersonation.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

// Encode : `<base64url(json)>.<base64url(hmac)>`
export function encodeImpersonation(p: ImpersonationPayload): string {
  const json = JSON.stringify(p);
  const body = Buffer.from(json, "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

// Décode + vérifie signature + TTL. Renvoie null si invalide.
export function decodeImpersonation(raw: string | undefined | null): ImpersonationPayload | null {
  if (!raw) return null;
  const idx = raw.indexOf(".");
  if (idx <= 0) return null;
  const body = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(body);
  const a = Buffer.from(sig, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  try {
    const json = Buffer.from(body, "base64url").toString("utf8");
    const p = JSON.parse(json) as ImpersonationPayload;
    if (!p.siteId || !p.auditId || typeof p.expiresAt !== "number") return null;
    if (p.expiresAt < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

// ============================================================
// Cote server components / server actions
// ============================================================

// Retourne le siteId impersonné actif, ou null si aucun. Vérifie signature
// ET expiration ; ne fait AUCUN contrôle super_admin ici (c'est le boulot
// des routes /platform et de la RLS via current_site_id()).
export async function getImpersonatedSiteId(): Promise<string | null> {
  const ck = await cookies();
  const raw = ck.get(IMPERSONATE_COOKIE)?.value;
  return decodeImpersonation(raw)?.siteId ?? null;
}

// Retourne le payload complet quand présent (utile pour tracer la sortie).
export async function getImpersonationPayload(): Promise<ImpersonationPayload | null> {
  const ck = await cookies();
  return decodeImpersonation(ck.get(IMPERSONATE_COOKIE)?.value);
}

// Pose le cookie d'impersonation. À appeler UNIQUEMENT depuis une route
// serveur ayant vérifié que l'appelant est super_admin.
export async function setImpersonation(siteId: string, auditId: string) {
  const payload: ImpersonationPayload = {
    siteId,
    auditId,
    expiresAt: Date.now() + IMPERSONATE_TTL_MS,
  };
  const ck = await cookies();
  ck.set(IMPERSONATE_COOKIE, encodeImpersonation(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(IMPERSONATE_TTL_MS / 1000),
    path: "/",
  });
}

// Efface le cookie. Idempotent.
export async function clearImpersonation() {
  const ck = await cookies();
  ck.delete(IMPERSONATE_COOKIE);
}

// ============================================================
// Cote server components qui lisent le header (posé par le middleware)
// ============================================================

// Retourne le siteId imposé par le middleware (via header x-impersonate-site).
// Sert à getCurrentSite() pour préférer l'impersonation sur app_user.site_id.
export async function getImpersonatedSiteIdFromHeader(): Promise<string | null> {
  try {
    const h = await headers();
    const v = h.get(IMPERSONATE_HEADER);
    return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
  } catch {
    return null;
  }
}
