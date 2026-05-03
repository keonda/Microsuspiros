import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.site.create({
    data: {
      name: "MicroSuspiros",
      url: "https://example.com",
      description: "Demo personal site entry. Replace or delete after setup.",
      category: "personal",
      status: "active",
      pinned: true
    }
  });
  await prisma.project.create({
    data: {
      name: "Homepage Assistant Setup",
      description: "Tune the dashboard, add real links, and configure Groq.",
      status: "active",
      priority: "high",
      pinned: true
    }
  });
  await prisma.quickLink.create({
    data: {
      name: "Groq Console",
      url: "https://console.groq.com",
      category: "AI",
      favorite: true
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
