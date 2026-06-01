"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/password";

const ROLES = [
  "ADMIN",
  "RESP_PROD",
  "RESP_PLANNING",
  "CHEF_EQUIPE",
  "ORDONNANCEMENT",
  "RH",
  "DIRECTION",
] as const;

type ActionState = { error?: string; success?: string };

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Controle d'acces : seul un ADMIN cree des utilisateurs.
  const current = await getCurrentUser();
  if (!current || current.role !== "ADMIN") {
    return { error: "Acces refuse." };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "");
  const password = String(formData.get("password") || "");

  if (!email || !name || !role || !password) {
    return { error: "Tous les champs sont requis." };
  }
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    return { error: "Role invalide." };
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    return { error: policyError };
  }

  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (existing) {
    return { error: "Un utilisateur avec cet email existe deja." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.appUser.create({
    data: { email, name, role: role as (typeof ROLES)[number], passwordHash },
  });

  revalidatePath("/admin/users");
  return { success: `Utilisateur ${email} cree.` };
}
