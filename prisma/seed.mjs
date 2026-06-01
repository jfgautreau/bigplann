// Seed : cree l'administrateur initial s'il n'existe pas.
// Idempotent - peut etre rejoue a chaque demarrage sans risque.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@usine.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin1234!";
  const name = process.env.ADMIN_NAME || "Administrateur";

  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin deja present : ${email} (rien a faire).`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.appUser.create({
    data: { email, passwordHash, name, role: "ADMIN", isActive: true },
  });
  console.log(`[seed] Admin cree : ${email}`);
}

main()
  .catch((e) => {
    console.error("[seed] Echec :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
