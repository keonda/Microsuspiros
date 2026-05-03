import { AppShell } from "@/components/app-shell";
import { AssistantChat } from "@/components/assistant-chat";
import { PageTitle } from "@/components/crud";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireUser();
  const conversations = await prisma.chatConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });

  return (
    <AppShell>
      <PageTitle title="AI Assistant" subtitle="Ask Groq about your private dashboard context and previous conversations." />
      <AssistantChat conversations={conversations} />
    </AppShell>
  );
}
