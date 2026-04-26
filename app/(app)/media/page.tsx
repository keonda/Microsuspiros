import Link from "next/link";
import { MediaLibrary } from "@/components/MediaLibrary";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MediaPage() {
  const user = await requireUser();
  const files = await prisma.mediaFile.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <main className="min-h-screen bg-paper p-6 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="text-sm text-clay dark:text-amber-300">
          Back to notes
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Media library</h1>
        <MediaLibrary initialFiles={JSON.parse(JSON.stringify(files))} />
      </div>
    </main>
  );
}
