import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { runGroqChat } from "@/lib/groq";
import { apiError, handleApiError } from "@/lib/http";
import { syncNoteLinks } from "@/lib/noteLinks";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const proposalSchema = z.object({
  intent: z.enum(["create_note", "append_note", "replace_note", "none"]),
  title: z.string().max(180).optional(),
  content: z.string().optional(),
  appendContent: z.string().optional(),
  reply: z.string().min(1)
});

const requestSchema = z.object({
  message: z.string().min(1),
  currentNoteId: z.string().optional(),
  apply: z.boolean().default(false),
  proposal: proposalSchema.optional()
});

function stripCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseProposal(value: string) {
  try {
    return proposalSchema.parse(JSON.parse(stripCodeFence(value)));
  } catch {
    return proposalSchema.parse({
      intent: "none",
      reply: value || "I could not turn that into a note action."
    });
  }
}

async function applyProposal(userId: string, proposal: z.infer<typeof proposalSchema>) {
  if (proposal.intent === "none") return { reply: proposal.reply };
  if (!proposal.title) throw new Error("A note title is required for this action.");

  const title = proposal.title.trim();
  const existing = await prisma.note.findFirst({
    where: { userId, title: { equals: title, mode: "insensitive" } }
  });

  if (proposal.intent === "create_note") {
    const content = proposal.content?.trim() || `# ${title}\n\n`;
    const note = existing
      ? await prisma.note.update({ where: { id: existing.id }, data: { content } })
      : await prisma.note.create({ data: { userId, title, content } });
    await syncNoteLinks(userId, note.id, note.content);
    return { note, reply: existing ? `Updated ${note.title}.` : `Created ${note.title}.` };
  }

  if (proposal.intent === "append_note") {
    const appendContent = proposal.appendContent?.trim() || proposal.content?.trim();
    if (!appendContent) throw new Error("Nothing to append.");
    const note = existing
      ? await prisma.note.update({
          where: { id: existing.id },
          data: { content: `${existing.content.trimEnd()}\n\n${appendContent}\n` }
        })
      : await prisma.note.create({ data: { userId, title, content: `# ${title}\n\n${appendContent}\n` } });
    if (existing) {
      await prisma.noteVersion.create({
        data: { userId, noteId: existing.id, title: existing.title, content: existing.content }
      });
    }
    await syncNoteLinks(userId, note.id, note.content);
    return { note, reply: existing ? `Added that to ${note.title}.` : `Created ${note.title} and added it there.` };
  }

  if (proposal.intent === "replace_note") {
    if (!proposal.content?.trim()) throw new Error("Replacement content is empty.");
    const note = existing
      ? await prisma.note.update({ where: { id: existing.id }, data: { content: proposal.content } })
      : await prisma.note.create({ data: { userId, title, content: proposal.content } });
    if (existing) {
      await prisma.noteVersion.create({
        data: { userId, noteId: existing.id, title: existing.title, content: existing.content }
      });
    }
    await syncNoteLinks(userId, note.id, note.content);
    return { note, reply: existing ? `Replaced ${note.title}.` : `Created ${note.title}.` };
  }

  return { reply: proposal.reply };
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = requestSchema.parse(await request.json());

    if (body.apply) {
      if (!body.proposal) return apiError("No proposed note action to apply", 400);
      const result = await applyProposal(user.id, body.proposal);
      return NextResponse.json({ applied: true, ...result });
    }

    const settings = await prisma.aiSettings.findUnique({ where: { userId: user.id } });
    if (!settings?.groqApiKeyEncrypted) return apiError("Add your Groq API key in Settings first", 400);

    const notes = await prisma.note.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
      take: 80
    });
    const currentNote = body.currentNoteId
      ? await prisma.note.findFirst({
          where: { id: body.currentNoteId, userId: user.id },
          select: { title: true, content: true }
        })
      : null;

    const result = await runGroqChat(decryptSecret(settings.groqApiKeyEncrypted), settings.groqModel, [
      {
        role: "system",
        content:
          "You are an assistant inside a private Markdown notes app. Convert the user's request into JSON only. Never apply changes yourself. Supported intents: create_note, append_note, replace_note, none. If the user says something like 'add this to servers.md', use append_note with title 'servers.md' and appendContent containing the text to add. Preserve Markdown. For risky or vague requests, use intent none and ask a short clarification. JSON shape: {\"intent\":\"append_note\",\"title\":\"servers.md\",\"appendContent\":\"...\",\"content\":\"...\",\"reply\":\"Short human summary of what will happen.\"}"
      },
      {
        role: "user",
        content: JSON.stringify({
          message: body.message,
          existingNoteTitles: notes.map((note) => note.title),
          currentNote: currentNote
            ? { title: currentNote.title, contentPreview: currentNote.content.slice(0, 2000) }
            : null
        })
      }
    ]);

    const proposal = parseProposal(result);
    return NextResponse.json({ proposal });
  } catch (error) {
    return handleApiError(error);
  }
}
