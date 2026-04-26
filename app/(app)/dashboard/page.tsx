import { NotesWorkspace } from "@/components/NotesWorkspace";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await requireUser();
  const [notes, notebooks, tags, settings] = await Promise.all([
    prisma.note.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        tags: { include: { tag: true } },
        incoming: { include: { sourceNote: { select: { id: true, title: true } } } },
        outgoing: true
      }
    }),
    prisma.notebook.findMany({
      where: { userId: user.id },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      include: { notes: { select: { id: true, title: true }, orderBy: { position: "asc" } } }
    }),
    prisma.tag.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    prisma.userSettings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
  ]);

  return (
    <NotesWorkspace
      user={user}
      initialNotes={JSON.parse(JSON.stringify(notes))}
      initialNotebooks={JSON.parse(JSON.stringify(notebooks))}
      initialTags={tags}
      initialSettings={settings}
    />
  );
}
