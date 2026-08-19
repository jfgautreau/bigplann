import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Convention Next.js 16 : "proxy" (ex-"middleware").
// Rafraichit la session Supabase, resout le site (multi-tenant) et protege
// les routes non publiques.
//
// MULTI-SITE (V1a, cf. tasks/multi-site.md) :
//   - Le middleware DEVRAIT resoudre le site depuis le sous-domaine du host
//     (usine-a.polaris.app → site.slug = 'usine-a').
//   - Tant que Polaris ne tourne qu'a Lebignon avec un domaine unique, on
//     pose un header 'x-site-id' vers le site historique (SITE_LEBIGNON_ID)
//     sans lecture Supabase ici : le middleware s'execute sur toutes les
//     requetes, y compris /affichage (TV, sans auth), et une requete DB par
//     coup ferait payer 30-50 ms a tout le monde.
//   - En PR suivante : lookup du slug avec cache (30 s), reponse 404 si le
//     slug n'existe pas, redirection si site.statut = 'suspendu'.

const SITE_LEBIGNON_ID = "00000000-0000-4000-8000-00000000c0de";

export async function proxy(req: NextRequest) {
  // -------- Résolution du site (fallback single-site en V1a) --------
  // Le header 'x-site-id' est le contrat avec le socle applicatif :
  // getCurrentSite() (src/lib/current-site.ts) le lit en priorité et
  // retombe sur SITE_LEBIGNON_ID si absent — on garantit donc les deux
  // sources cohérentes.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-site-id", SITE_LEBIGNON_ID);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Routes publiques (flux d'authentification).
  // /auth/callback echange un code OTP : le user n'est pas encore authentifie.
  // /forgot et /reset doivent rester accessibles pour la recuperation de mdp.
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname === "/forgot" ||
    pathname === "/reset" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/affichage"); // pages couloir : acces sans login (cf. cahier 8.4)

  // getUser() valide le JWT cote serveur (recommande par Supabase),
  // contrairement a getSession() qui lit juste le cookie sans verification.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Affichage couloir (ecran 24/7) : on interdit tout cache en aval (navigateur
  // de la TV, proxy reseau) pour que le F5 / rafraichissement auto montre
  // toujours la derniere version. La page est deja "force-dynamic" cote serveur.
  if (pathname.startsWith("/affichage")) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
