import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { applyPendingAiAction, getConversationWithActions } from "@/lib/ai-actions";

export async function POST(request: NextRequest) {
  await requireUser();
  const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());
  const result = await applyPendingAiAction(id);
  const conversation = await getConversationWithActions(result.conversationId);
  return NextResponse.json({ conversation, message: result.message });
}
