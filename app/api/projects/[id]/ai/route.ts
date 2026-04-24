import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const aiSchema = z.object({
  command: z.enum([
    "summarize",
    "next_scene",
    "inconsistencies",
    "rewrite_softer",
    "rewrite_darker",
    "extract_character_notes",
    "chat"
  ]),
  message: z.string().trim().max(2000).optional(),
  documentId: z.string().optional(),
  selectedText: z.string().max(10000).optional(),
  documentText: z.string().max(60000).optional(),
  contextMode: z.enum(["current_document", "selected_text"]).default("current_document")
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = aiSchema.parse(await request.json());
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const settings = await prisma.aISettings.findUnique({ where: { userId: user.id } });
  const apiKey = decryptSecret(settings?.apiKeyEncrypted);
  if (!settings || !apiKey) {
    return Response.json({
      setupRequired: true,
      text: "Add your Groq API key in Settings to use the AI assistant. The rest of Writer Studio works without it."
    });
  }

  const context = (body.selectedText || body.documentText || "").slice(0, 60000);
  const prompt = promptFor(body.command, body.message, context);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: "system",
            content:
              "You are a careful fiction writing assistant. Never claim to have changed the manuscript. Return concise, useful suggestions that the writer can choose to apply."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });
    if (!response.ok) {
      const text = await response.text();
      return Response.json({ error: `Groq request failed: ${text.slice(0, 240)}` }, { status: 502 });
    }
    const json = await response.json();
    return Response.json({ text: json.choices?.[0]?.message?.content || "No response returned." });
  } catch (error) {
    console.error("AI request failed", error);
    return Response.json({ error: "The AI assistant could not reach Groq right now." }, { status: 502 });
  }
}

function promptFor(command: string, message: string | undefined, context: string) {
  const commands: Record<string, string> = {
    summarize: "Summarize the current document in a compact, writer-friendly way.",
    next_scene: "Suggest the next scene, including purpose, conflict, and a possible opening beat.",
    inconsistencies: "Find possible inconsistencies, continuity issues, unclear motivations, or timeline problems.",
    rewrite_softer: "Rewrite the selected passage in a softer, more tender tone. Preserve meaning.",
    rewrite_darker: "Rewrite the selected passage in a darker, more ominous tone. Preserve meaning.",
    extract_character_notes: "Extract reusable character notes from this text. Include names, traits, desires, conflicts, and open questions.",
    chat: message || "Help me think through this writing."
  };
  return `${commands[command]}\n\nContext:\n${context || "(No manuscript context was provided.)"}`;
}
