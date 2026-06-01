import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, getSession } from "@/lib/session";

const MAX_FAILED_ATTEMPTS = 5;

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

// Tentative de connexion : verifie identifiants, gere le verrouillage
// apres 5 echecs (cf. cahier 3.3) et ouvre la session si succes.
export async function login(
  emailRaw: string,
  password: string
): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const genericError = "Identifiants invalides.";

  const user = await prisma.appUser.findUnique({ where: { email } });

  // Reponse generique pour ne pas reveler l'existence du compte.
  if (!user) return { ok: false, error: genericError };

  if (!user.isActive) {
    return { ok: false, error: "Compte desactive. Contactez un administrateur." };
  }

  if (user.lockedAt) {
    return {
      ok: false,
      error:
        "Compte verrouille apres trop d'echecs. Contactez un administrateur.",
    };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedAttempts + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        failedAttempts: attempts,
        lockedAt: lock ? new Date() : null,
      },
    });
    if (lock) {
      return {
        ok: false,
        error:
          "Compte verrouille apres 5 echecs. Contactez un administrateur.",
      };
    }
    return { ok: false, error: genericError };
  }

  // Succes : remise a zero du compteur + ouverture de session.
  if (user.failedAttempts !== 0) {
    await prisma.appUser.update({
      where: { id: user.id },
      data: { failedAttempts: 0 },
    });
  }

  await createSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  return { ok: true };
}

// Utilisateur courant (depuis la session) ou null.
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.appUser.findUnique({ where: { id: session.sub } });
}
