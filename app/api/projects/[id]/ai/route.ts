import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const aiSchema = z.object({
  command: z.enum([
    "summarize",
    "next_scene",
    "inconsistencies",
    "pacing",
    "contradictions",
    "rewrite_softer",
    "rewrite_darker",
    "rewrite_cinematic",
    "extract_character_notes",
    "extract_location_details",
    "scene_summary",
    "chapter_titles",
    "scene_questions",
    "chat"
  ]),
  message: z.string().trim().max(2000).optional(),
  documentId: z.string().optional(),
  selectedText: z.string().max(10000).optional(),
  documentText: z.string().max(60000).optional(),
  scenes: z.array(z.object({ title: z.string(), summary: z.string().optional(), goal: z.string().nullable().optional(), conflict: z.string().nullable().optional(), outcome: z.string().nullable().optional() })).default([]),
  entities: z.array(z.object({ name: z.string(), type: z.string(), description: z.string().optional() })).default([]),
  contextMode: z.enum(["current_document", "selected_text", "document_linked_notes", "document_scenes", "document_entities", "selected_project_context"]).default("current_document")
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

  const documentContext = (body.selectedText || body.documentText || "").slice(0, 60000);
  const context = buildContext(documentContext, body.contextMode, body.scenes, body.entities);
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
    pacing: "Identify pacing issues. Call out scenes or passages that feel rushed, static, repetitive, or under-motivated.",
    contradictions: "Find contradictions between the chapter and provided scenes/entities/context. Be specific and cautious.",
    rewrite_softer: "Rewrite the selected passage in a softer, more tender tone. Preserve meaning.",
    rewrite_darker: "Rewrite the selected passage in a darker, more ominous tone. Preserve meaning.",
    rewrite_cinematic: "Rewrite the selected passage in a more cinematic style with concrete sensory detail. Preserve meaning.",
    extract_character_notes: "Extract reusable character notes from this text. Include names, traits, desires, conflicts, and open questions.",
    extract_location_details: "Extract reusable location details from this text. Include atmosphere, geography, history, and open questions.",
    scene_summary: "Create a concise scene summary with POV, goal, conflict, outcome, and emotional turn.",
    chapter_titles: "Generate 10 chapter title ideas with different moods. Keep them literary and specific.",
    scene_questions: "Generate thoughtful questions that would help develop this scene without taking over the writer's choices.",
    chat: message || "Help me think through this writing."
  };
  return `${commands[command]}\n\nContext:\n${context || "(No manuscript context was provided.)"}`;
}

function buildContext(
  documentContext: string,
  contextMode: string,
  scenes: { title: string; summary?: string; goal?: string | null; conflict?: string | null; outcome?: string | null }[],
  entities: { name: string; type: string; description?: string }[]
) {
  const sceneContext = scenes
    .map((scene) => `- ${scene.title}: ${scene.summary || ""}${scene.goal ? ` Goal: ${scene.goal}.` : ""}${scene.conflict ? ` Conflict: ${scene.conflict}.` : ""}${scene.outcome ? ` Outcome: ${scene.outcome}.` : ""}`)
    .join("\n");
  const entityContext = entities.map((entity) => `- ${entity.name} (${entity.type}): ${entity.description || "No description yet."}`).join("\n");
  if (contextMode === "document_scenes") return `Document:\n${documentContext}\n\nScenes:\n${sceneContext || "(No scene cards yet.)"}`;
  if (contextMode === "document_entities") return `Document:\n${documentContext}\n\nEntities:\n${entityContext || "(No confirmed story entities yet.)"}`;
  if (contextMode === "selected_project_context") return `Document:\n${documentContext}\n\nScenes:\n${sceneContext || "(No scene cards yet.)"}\n\nEntities:\n${entityContext || "(No confirmed story entities yet.)"}`;
  if (contextMode === "document_linked_notes") return `Document:\n${documentContext}\n\nLinked-note context is currently limited to wiki/backlink text in the document.`;
  return documentContext;
}
