import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { runGroqChat } from "@/lib/groq";
import { apiError, handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum([
    "summarize",
    "rewrite",
    "markdown",
    "outline",
    "links",
    "organize",
    "bullets",
    "actions",
    "tags"
  ]),
  content: z.string().min(1),
  selectedText: z.string().optional()
});

const prompts: Record<string, string> = {
  summarize: "Summarize the note clearly in Markdown.",
  rewrite: "Rewrite the selected text or note to be clearer, preserving meaning. Return Markdown only.",
  markdown: "Format this messy text as a polished Markdown note.",
  outline: "Create a useful Markdown outline from this note.",
  links: "Suggest Obsidian-style [[wiki links]] that should exist for this note. Include brief reasons.",
  organize: "Suggest tags, notebook placement, and a compact structure for this note.",
  bullets: "Turn this into concise Markdown bullet points.",
  actions: "Extract action items as a Markdown task list.",
  tags: "Suggest 5-10 lowercase tags as a comma-separated list."
};

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const settings = await prisma.aiSettings.findUnique({ where: { userId: user.id } });
    if (!settings?.groqApiKeyEncrypted) return apiError("Add your Groq API key in Settings first", 400);
    const source = body.selectedText?.trim() || body.content;
    const result = await runGroqChat(decryptSecret(settings.groqApiKeyEncrypted), settings.groqModel, [
      {
        role: "system",
        content:
          "You are a private-first Markdown writing assistant inside a notes app. Never claim to have changed the note. Return useful Markdown."
      },
      { role: "user", content: `${prompts[body.action]}\n\n${source}` }
    ]);
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
