import { AIAssistant } from "@/components/ai-assistant";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectAssistantPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return null;
  const latestDocument = await prisma.document.findFirst({ where: { projectId: id, userId: user.id, isTrash: false }, orderBy: { updatedAt: "desc" } });

  return (
    <div className="p-6">
      <h1 className="font-serif text-3xl font-bold">AI Assistant</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Optional Groq-powered writing help. Suggestions never overwrite your manuscript unless you choose to insert them.</p>
      <div className="mt-5 max-w-2xl rounded-xl bg-white p-5 ring-1 ring-stone-200">
        <AIAssistant projectId={id} documentId={latestDocument?.id} documentText={latestDocument?.plainText || ""} selectedText="" />
      </div>
    </div>
  );
}
