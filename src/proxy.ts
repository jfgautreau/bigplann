import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Convention Next.js 16 : "proxy" (ex-"middleware").
// Rafraichit la session Supabase et protege les routes non publiques.
export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

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

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
