import Link from "next/link";
import { AdminPanel } from "@/components/AdminPanel";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  await requireAdmin();
  const [users, stats] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        disabled: true,
        createdAt: true,
        _count: { select: { notes: true, mediaFiles: true } }
      }
    }),
    Promise.all([
      prisma.user.count(),
      prisma.note.count(),
      prisma.mediaFile.count(),
      prisma.mediaFile.aggregate({ _sum: { sizeBytes: true } })
    ])
  ]);

  return (
    <main className="min-h-screen bg-paper p-6 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="text-sm text-clay dark:text-amber-300">
          Back to notes
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Admin</h1>
        <AdminPanel
          initialUsers={JSON.parse(JSON.stringify(users))}
          stats={{
            users: stats[0],
            notes: stats[1],
            mediaFiles: stats[2],
            storageBytes: stats[3]._sum.sizeBytes ?? 0
          }}
        />
      </div>
    </main>
  );
}
