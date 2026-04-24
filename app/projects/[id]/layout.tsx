import { notFound } from "next/navigation";
import { ProjectSidebar } from "@/components/project-sidebar";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) notFound();
  const [documents, trash] = await Promise.all([
    prisma.document.findMany({ where: { projectId: id, userId: user.id, kind: "MANUSCRIPT", isTrash: false }, orderBy: { sortOrder: "asc" } }),
    prisma.document.findMany({ where: { projectId: id, userId: user.id, isTrash: true }, orderBy: { updatedAt: "desc" } })
  ]);

  return (
    <main className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[300px_1fr]">
      <ProjectSidebar project={project} documents={documents} trash={trash} />
      <div className="min-w-0">{children}</div>
    </main>
  );
}
