import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  const displayName = process.env.SEED_ADMIN_NAME?.trim() || "Studio Admin";

  if (!email || !password) {
    console.log("No seed admin created. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: "ADMIN", disabled: false } });
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      displayName,
      role: "ADMIN",
      passwordHash: await hash(password, 12)
    }
  });

  console.log(`Created Writer Studio admin: ${email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
