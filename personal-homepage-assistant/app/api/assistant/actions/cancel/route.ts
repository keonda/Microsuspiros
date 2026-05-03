import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getConversationWithActions } from "@/lib/ai-actions";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  await requireUser();
  const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());
  const action = await prisma.pendingAiAction.update({
    where: { id },
    data: { status: "cancelled", resultMessage: "Cancelled before saving." }
  });
  await prisma.chatMessage.create({
    data: {
      conversationId: action.conversationId,
      role: "assistant",
      content: `Cancelled. I did not save "${action.title}".`
    }
  });
  const conversation = await getConversationWithActions(action.conversationId);
  return NextResponse.json({ conversation });
}
