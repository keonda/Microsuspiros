"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, ProjectStatus, StoryNoteType } from "@prisma/client";
import { createSession, destroySession, hashPassword, nextRegisteredRole, requireAdmin, requireUser, verifyPassword } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { syncInternalLinks } from "@/lib/internal-links";
import { applyManualSplitMarker, detectPdfSections, extractPdfText, mergeSections, type DetectedPdfSection } from "@/lib/pdf-import";
import { prisma } from "@/lib/prisma";
import { deleteStoredUpload, storeUpload, validateUpload } from "@/lib/uploads";
import { escapeHtml, wordCount } from "@/lib/writer-utils";

const emailSchema = z.string().email().max(255).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(8, "Use at least 8 characters.").max(200);
const titleSchema = z.string().trim().min(1).max(180);

export type ActionState = { ok?: boolean; error?: string };

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      email: emailSchema,
      password: passwordSchema,
      displayName: z.string().trim().min(1).max(120)
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your registration details." };

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return { error: "An account with that email already exists." };

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        role: await nextRegisteredRole(),
        passwordHash: await hashPassword(parsed.data.password)
      }
    });

    await createSession(user.id);
  } catch (error) {
    console.error("Registration failed", error);
    return { error: databaseSetupError() };
  }
  redirect("/");
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password." };

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || user.disabled || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return { error: "Invalid email or password." };
    }

    await createSession(user.id);
  } catch (error) {
    console.error("Login failed", error);
    return { error: databaseSetupError() };
  }
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  const parsed = z
    .object({
      title: titleSchema,
      subtitle: z.string().trim().max(180).optional(),
      genre: z.string().trim().max(80).optional(),
      description: z.string().trim().max(1200).optional()
    })
    .parse(Object.fromEntries(formData));

  const project = await prisma.project.create({
    data: {
      title: parsed.title,
      subtitle: parsed.subtitle || null,
      genre: parsed.genre || null,
      description: parsed.description || null,
      userId: user.id
    }
  });

  await prisma.brainstormBoard.create({
    data: {
      title: "Corkboard",
      projectId: project.id,
      userId: user.id,
      columns: {
        create: [
          { title: "Ideas", sortOrder: 0, projectId: project.id },
          { title: "Maybe", sortOrder: 1, projectId: project.id },
          { title: "Important", sortOrder: 2, projectId: project.id },
          { title: "Later", sortOrder: 3, projectId: project.id }
        ]
      }
    }
  });

  await prisma.document.create({
    data: {
      title: "Chapter 1",
      projectId: project.id,
      userId: user.id,
      sortOrder: 0,
      contentHtml: "<p></p>"
    }
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = z
    .object({
      title: titleSchema,
      subtitle: z.string().trim().max(180).optional(),
      genre: z.string().trim().max(80).optional(),
      status: z.nativeEnum(ProjectStatus),
      description: z.string().trim().max(1200).optional()
    })
    .parse(Object.fromEntries(formData));

  await prisma.project.updateMany({
    where: { id: projectId, userId: user.id },
    data: {
      title: parsed.title,
      subtitle: parsed.subtitle || null,
      genre: parsed.genre || null,
      status: parsed.status,
      description: parsed.description || null
    }
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function createDocumentAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const title = titleSchema.parse(formData.get("title"));
  const maxOrder = await prisma.document.aggregate({
    where: { projectId, userId: user.id, kind: "MANUSCRIPT" },
    _max: { sortOrder: true }
  });
  const document = await prisma.document.create({
    data: {
      title,
      projectId,
      userId: user.id,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      contentHtml: "<p></p>"
    }
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/documents/${document.id}`);
}

export async function renameDocumentAction(projectId: string, documentId: string, formData: FormData) {
  const user = await requireUser();
  const title = titleSchema.parse(formData.get("title"));
  await prisma.document.updateMany({ where: { id: documentId, projectId, userId: user.id }, data: { title } });
  revalidatePath(`/projects/${projectId}`);
}

export async function trashDocumentAction(projectId: string, documentId: string) {
  const user = await requireUser();
  await prisma.document.updateMany({ where: { id: documentId, projectId, userId: user.id }, data: { isTrash: true } });
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function restoreDocumentAction(projectId: string, documentId: string) {
  const user = await requireUser();
  await prisma.document.updateMany({ where: { id: documentId, projectId, userId: user.id }, data: { isTrash: false } });
  revalidatePath(`/projects/${projectId}`);
}

export async function createStoryNoteAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = z
    .object({
      title: titleSchema,
      type: z.nativeEnum(StoryNoteType),
      body: z.string().trim().max(20000).optional(),
      tagsText: z.string().trim().max(500).optional()
    })
    .parse(Object.fromEntries(formData));

  const note = await prisma.storyNote.create({ data: { ...parsed, body: parsed.body || "", tagsText: parsed.tagsText || "", projectId, userId: user.id } });
  await syncInternalLinks(prisma, { projectId, sourceType: "STORY_NOTE", sourceId: note.id, text: `${note.title}\n${note.body}` });
  revalidatePath(`/projects/${projectId}/notes`);
}

export async function updateStoryNoteAction(projectId: string, noteId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = z
    .object({
      title: titleSchema,
      type: z.nativeEnum(StoryNoteType),
      body: z.string().trim().max(20000).optional(),
      tagsText: z.string().trim().max(500).optional()
    })
    .parse(Object.fromEntries(formData));

  await prisma.storyNote.updateMany({
    where: { id: noteId, projectId, userId: user.id },
    data: { ...parsed, body: parsed.body || "", tagsText: parsed.tagsText || "" }
  });
  await syncInternalLinks(prisma, { projectId, sourceType: "STORY_NOTE", sourceId: noteId, text: `${parsed.title}\n${parsed.body || ""}` });
  revalidatePath(`/projects/${projectId}/notes`);
}

export async function createResearchNoteAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = z
    .object({
      title: titleSchema,
      sourceTitle: z.string().trim().max(180).optional(),
      sourceUrl: z.string().trim().url().or(z.literal("")).optional(),
      author: z.string().trim().max(120).optional(),
      excerpt: z.string().trim().max(10000).optional(),
      summary: z.string().trim().max(12000).optional(),
      personalNotes: z.string().trim().max(12000).optional(),
      tagsText: z.string().trim().max(500).optional()
    })
    .parse(Object.fromEntries(formData));

  const note = await prisma.researchNote.create({
    data: {
      ...parsed,
      sourceTitle: parsed.sourceTitle || null,
      sourceUrl: parsed.sourceUrl || null,
      author: parsed.author || null,
      excerpt: parsed.excerpt || null,
      summary: parsed.summary || "",
      personalNotes: parsed.personalNotes || "",
      tagsText: parsed.tagsText || "",
      projectId,
      userId: user.id
    }
  });
  await syncInternalLinks(prisma, { projectId, sourceType: "RESEARCH_NOTE", sourceId: note.id, text: `${note.title}\n${note.summary}\n${note.personalNotes}` });
  revalidatePath(`/projects/${projectId}/research`);
}

export async function uploadResourceAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Choose a file to upload.");

  const error = validateUpload(file);
  if (error) throw new Error(error);

  const stored = await storeUpload(projectId, file);
  await prisma.resource.create({
    data: {
      title: String(formData.get("title") || file.name).slice(0, 180),
      originalName: file.name,
      fileName: stored.fileName,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      path: stored.relativePath,
      notes: String(formData.get("notes") || "").slice(0, 2000),
      tagsText: String(formData.get("tagsText") || "").slice(0, 500),
      projectId,
      userId: user.id
    }
  });

  revalidatePath(`/projects/${projectId}/resources`);
}

export async function uploadPdfForImportAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Choose a PDF to import.");
  if (file.type !== "application/pdf") throw new Error("Only PDF files can be imported here.");

  const error = validateUpload(file);
  if (error) throw new Error(error);

  const stored = await storeUpload(projectId, file);
  const resource = await prisma.resource.create({
    data: {
      title: String(formData.get("title") || file.name).slice(0, 180),
      originalName: file.name,
      fileName: stored.fileName,
      mimeType: file.type,
      fileSize: file.size,
      path: stored.relativePath,
      notes: String(formData.get("notes") || "Imported PDF source").slice(0, 2000),
      tagsText: String(formData.get("tagsText") || "").slice(0, 500),
      extractionStatus: "PENDING",
      projectId,
      userId: user.id
    }
  });

  const extraction = await extractPdfText(stored.absolutePath, file.size);
  const detection = extraction.text ? detectPdfSections(extraction.text) : { sections: [], warnings: [extraction.error || "This PDF appears to be scanned or image-based. OCR is not supported yet."] };
  const updatedResource = await prisma.resource.update({
    where: { id: resource.id },
    data: {
      extractedText: extraction.text,
      extractionStatus: extraction.status,
      extractionError: extraction.error,
      pageCount: extraction.pageCount
    }
  });
  const session = await prisma.pdfImportSession.create({
    data: {
      projectId,
      resourceId: resource.id,
      userId: user.id,
      extractedText: extraction.text,
      detectedSectionsJson: detection as unknown as Prisma.InputJsonValue,
      status: updatedResource.extractionStatus === "EXTRACTED" ? "EXTRACTED" : updatedResource.extractionStatus === "NO_TEXT" ? "NO_TEXT" : "FAILED"
    }
  });

  revalidatePath(`/projects/${projectId}/resources`);
  redirect(`/projects/${projectId}/pdf-import/${session.id}`);
}

export async function rerunPdfDetectionAction(projectId: string, sessionId: string, formData: FormData) {
  const user = await requireUser();
  const marker = z.string().trim().max(120).parse(formData.get("manualMarker") || "");
  const session = await prisma.pdfImportSession.findFirst({ where: { id: sessionId, projectId, userId: user.id } });
  if (!session?.extractedText?.trim()) throw new Error("This PDF has no extracted text to split.");

  const detection = marker ? applyManualSplitMarker(session.extractedText, marker) : detectPdfSections(session.extractedText);
  await prisma.pdfImportSession.update({
    where: { id: session.id },
    data: { detectedSectionsJson: { ...detection, manualMarker: marker } as unknown as Prisma.InputJsonValue }
  });

  revalidatePath(`/projects/${projectId}/pdf-import/${sessionId}`);
}

export async function importPdfSectionsAction(projectId: string, sessionId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = z
    .object({
      destination: z.enum(["DOCUMENT", "STORY_NOTE", "RESEARCH_NOTE"]),
      importMode: z.enum(["sections", "single"]),
      singleTitle: titleSchema
    })
    .parse({
      destination: formData.get("destination"),
      importMode: formData.get("importMode"),
      singleTitle: formData.get("singleTitle")
    });
  const session = await prisma.pdfImportSession.findFirst({
    where: { id: sessionId, projectId, userId: user.id },
    include: { resource: true }
  });
  if (!session) throw new Error("PDF import session not found.");
  if (!session.extractedText?.trim() || session.resource.extractionStatus !== "EXTRACTED") {
    throw new Error(session.resource.extractionError || "This PDF has no extracted text to import.");
  }

  const detected = pdfSessionPayload(session.detectedSectionsJson).sections;
  const selectedSections =
    parsed.importMode === "single"
      ? [
          {
            id: "single",
            title: parsed.singleTitle,
            startIndex: 0,
            endIndex: session.extractedText.length,
            text: session.extractedText,
            confidence: 1,
            detectedPattern: "single-document",
            include: true
          } satisfies DetectedPdfSection
        ]
      : selectedPdfSections(formData, detected);

  if (!selectedSections.length) throw new Error("Choose at least one section to import.");

  const created = await createImportedPdfItems({
    projectId,
    userId: user.id,
    resourceId: session.resourceId,
    resourceOriginalName: session.resource.originalName,
    sessionId: session.id,
    destination: parsed.destination,
    sections: selectedSections
  });

  await prisma.pdfImportSession.update({ where: { id: session.id }, data: { status: "IMPORTED" } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/resources`);
  revalidatePath(`/projects/${projectId}/pdf-import/${sessionId}`);

  const first = created[0];
  if (first?.targetType === "DOCUMENT") redirect(`/projects/${projectId}/documents/${first.targetId}`);
  if (first?.targetType === "STORY_NOTE") redirect(`/projects/${projectId}/notes#${first.targetId}`);
  redirect(`/projects/${projectId}/research#${first?.targetId || ""}`);
}

export async function importPdfResourceAction(projectId: string, resourceId: string, formData: FormData) {
  const user = await requireUser();
  const destination = z.enum(["DOCUMENT", "STORY_NOTE", "RESEARCH_NOTE"]).parse(formData.get("destination"));
  const title = titleSchema.parse(formData.get("title"));
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, projectId, userId: user.id } });
  if (!resource) throw new Error("PDF resource not found.");
  if (resource.extractionStatus !== "EXTRACTED" || !resource.extractedText?.trim()) {
    throw new Error(resource.extractionError || "This PDF has no extracted text to import.");
  }

  const text = resource.extractedText;
  const html = plainTextToHtml(text);

  if (destination === "DOCUMENT") {
    const maxOrder = await prisma.document.aggregate({ where: { projectId, userId: user.id, kind: "MANUSCRIPT" }, _max: { sortOrder: true } });
    const document = await prisma.document.create({
      data: {
        title,
        contentHtml: html,
        plainText: text,
        wordCount: wordCount(text),
        charCount: text.length,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        projectId,
        userId: user.id,
        resourceLinks: { create: { resourceId: resource.id, linkType: "DOCUMENT" } }
      }
    });
    await syncInternalLinks(prisma, { projectId, sourceType: "DOCUMENT", sourceId: document.id, text: `${document.title}\n${document.plainText}` });
    revalidatePath(`/projects/${projectId}`);
    redirect(`/projects/${projectId}/documents/${document.id}`);
  }

  if (destination === "STORY_NOTE") {
    const note = await prisma.storyNote.create({
      data: {
        title,
        body: text,
        type: "GENERAL",
        projectId,
        userId: user.id,
        resourceLinks: { create: { resourceId: resource.id, linkType: "STORY_NOTE" } }
      }
    });
    await syncInternalLinks(prisma, { projectId, sourceType: "STORY_NOTE", sourceId: note.id, text: `${note.title}\n${note.body}` });
    revalidatePath(`/projects/${projectId}/notes`);
    redirect(`/projects/${projectId}/notes#${note.id}`);
  }

  const research = await prisma.researchNote.create({
    data: {
      title,
      sourceTitle: resource.originalName,
      summary: text,
      personalNotes: "",
      projectId,
      userId: user.id,
      resourceLinks: { create: { resourceId: resource.id, linkType: "RESEARCH_NOTE" } }
    }
  });
  await syncInternalLinks(prisma, { projectId, sourceType: "RESEARCH_NOTE", sourceId: research.id, text: `${research.title}\n${research.summary}` });
  revalidatePath(`/projects/${projectId}/research`);
  redirect(`/projects/${projectId}/research#${research.id}`);
}

export async function deleteResourceAction(projectId: string, resourceId: string) {
  const user = await requireUser();
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, projectId, userId: user.id } });
  if (!resource) throw new Error("Resource not found.");

  await prisma.resource.delete({ where: { id: resource.id } });
  await deleteStoredUpload(resource.path);
  revalidatePath(`/projects/${projectId}/resources`);
}

export async function createBrainstormCardAction(projectId: string, columnId: string, formData: FormData) {
  const user = await requireUser();
  const column = await prisma.brainstormColumn.findFirst({ where: { id: columnId, projectId }, include: { board: true } });
  if (!column) throw new Error("Column not found.");
  const parsed = z
    .object({
      title: titleSchema,
      body: z.string().trim().max(3000).optional(),
      color: z.string().trim().max(30).optional(),
      tagsText: z.string().trim().max(500).optional()
    })
    .parse(Object.fromEntries(formData));
  const maxOrder = await prisma.brainstormCard.aggregate({ where: { columnId }, _max: { sortOrder: true } });
  const card = await prisma.brainstormCard.create({
    data: {
      ...parsed,
      body: parsed.body || "",
      color: parsed.color || "#f2d7a2",
      tagsText: parsed.tagsText || "",
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      boardId: column.boardId,
      columnId,
      projectId,
      userId: user.id
    }
  });
  await syncInternalLinks(prisma, { projectId, sourceType: "BRAINSTORM_CARD", sourceId: card.id, text: `${card.title}\n${card.body}` });
  revalidatePath(`/projects/${projectId}/brainstorm`);
}

export async function moveBrainstormCardAction(projectId: string, cardId: string, columnId: string) {
  const user = await requireUser();
  const maxOrder = await prisma.brainstormCard.aggregate({ where: { columnId, projectId }, _max: { sortOrder: true } });
  await prisma.brainstormCard.updateMany({
    where: { id: cardId, projectId, userId: user.id },
    data: { columnId, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 }
  });
  revalidatePath(`/projects/${projectId}/brainstorm`);
}

export async function updateUserAdminAction(userId: string, formData: FormData) {
  await requireAdmin();
  const role = z.enum(["USER", "ADMIN"]).parse(formData.get("role"));
  const disabled = formData.get("disabled") === "on";
  await prisma.user.update({ where: { id: userId }, data: { role, disabled } });
  revalidatePath("/admin");
}

export async function updateAISettingsAction(formData: FormData) {
  const user = await requireUser();
  const parsed = z
    .object({
      provider: z.literal("GROQ"),
      model: z.string().trim().min(1).max(120),
      apiKey: z.string().trim().max(400).optional()
    })
    .parse(Object.fromEntries(formData));

  const existing = await prisma.aISettings.findUnique({ where: { userId: user.id } });
  await prisma.aISettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      provider: parsed.provider,
      model: parsed.model,
      apiKeyEncrypted: parsed.apiKey ? encryptSecret(parsed.apiKey) : null
    },
    update: {
      provider: parsed.provider,
      model: parsed.model,
      apiKeyEncrypted: parsed.apiKey ? encryptSecret(parsed.apiKey) : existing?.apiKeyEncrypted
    }
  });

  revalidatePath("/settings");
}

export async function searchEverything(userId: string, query: string) {
  const contains: Prisma.StringFilter = { contains: query, mode: "insensitive" };
  const [projects, documents, storyNotes, researchNotes, cards, resources] = await Promise.all([
    prisma.project.findMany({ where: { userId, OR: [{ title: contains }, { description: contains }, { genre: contains }] }, take: 8 }),
    prisma.document.findMany({ where: { userId, isTrash: false, OR: [{ title: contains }, { plainText: contains }] }, take: 8 }),
    prisma.storyNote.findMany({ where: { userId, OR: [{ title: contains }, { body: contains }, { tagsText: contains }] }, take: 8 }),
    prisma.researchNote.findMany({ where: { userId, OR: [{ title: contains }, { summary: contains }, { personalNotes: contains }, { tagsText: contains }] }, take: 8 }),
    prisma.brainstormCard.findMany({ where: { userId, OR: [{ title: contains }, { body: contains }, { tagsText: contains }] }, take: 8 }),
    prisma.resource.findMany({ where: { userId, OR: [{ title: contains }, { originalName: contains }, { tagsText: contains }] }, take: 8 })
  ]);
  return { projects, documents, storyNotes, researchNotes, cards, resources };
}

// TODO: Collaborative writing should replace simple ownership checks with membership/permissions.

function pdfSessionPayload(value: Prisma.JsonValue): { sections: DetectedPdfSection[]; warnings: string[]; manualMarker?: string } {
  const parsed = z
    .object({
      sections: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            startIndex: z.number(),
            endIndex: z.number(),
            text: z.string(),
            confidence: z.number(),
            detectedPattern: z.string(),
            include: z.boolean().default(true),
            warnings: z.array(z.string()).optional()
          })
        )
        .default([]),
      warnings: z.array(z.string()).default([]),
      manualMarker: z.string().optional()
    })
    .safeParse(value);
  return parsed.success ? parsed.data : { sections: [], warnings: ["Stored PDF chapter detection data could not be read."] };
}

function selectedPdfSections(formData: FormData, sections: DetectedPdfSection[]) {
  const sectionIds = formData.getAll("sectionId").map(String);
  const byId = new Map(sections.map((section) => [section.id, section]));
  const selected = sectionIds
    .map((id) => {
      const source = byId.get(id);
      if (!source || formData.get(`include-${id}`) !== "on") return null;
      return {
        ...source,
        title: titleSchema.parse(formData.get(`title-${id}`)),
        include: true
      };
    })
    .filter((section): section is DetectedPdfSection => Boolean(section));
  const mergeIds = new Set(sectionIds.filter((id) => formData.get(`merge-${id}`) === "on"));
  return mergeSections(selected, mergeIds);
}

async function createImportedPdfItems({
  projectId,
  userId,
  resourceId,
  resourceOriginalName,
  sessionId,
  destination,
  sections
}: {
  projectId: string;
  userId: string;
  resourceId: string;
  resourceOriginalName: string;
  sessionId: string;
  destination: "DOCUMENT" | "STORY_NOTE" | "RESEARCH_NOTE";
  sections: DetectedPdfSection[];
}) {
  const created: { targetType: "DOCUMENT" | "STORY_NOTE" | "RESEARCH_NOTE"; targetId: string }[] = [];

  if (destination === "DOCUMENT") {
    const maxOrder = await prisma.document.aggregate({ where: { projectId, userId, kind: "MANUSCRIPT" }, _max: { sortOrder: true } });
    let sortOrder = maxOrder._max.sortOrder ?? 0;
    for (const [index, section] of sections.entries()) {
      sortOrder += 1;
      const text = section.text.trim();
      const document = await prisma.document.create({
        data: {
          title: section.title,
          contentHtml: plainTextToHtml(text),
          plainText: text,
          wordCount: wordCount(text),
          charCount: text.length,
          sortOrder,
          projectId,
          userId,
          resourceLinks: { create: { resourceId, linkType: "DOCUMENT" } }
        }
      });
      await prisma.pdfImportedItem.create({ data: { importSessionId: sessionId, targetType: "DOCUMENT", targetId: document.id, title: document.title, sortOrder: index } });
      await syncInternalLinks(prisma, { projectId, sourceType: "DOCUMENT", sourceId: document.id, text: `${document.title}\n${document.plainText}` });
      created.push({ targetType: "DOCUMENT", targetId: document.id });
    }
    return created;
  }

  if (destination === "STORY_NOTE") {
    for (const [index, section] of sections.entries()) {
      const text = section.text.trim();
      const note = await prisma.storyNote.create({
        data: {
          title: section.title,
          body: text,
          type: "GENERAL",
          projectId,
          userId,
          resourceLinks: { create: { resourceId, linkType: "STORY_NOTE" } }
        }
      });
      await prisma.pdfImportedItem.create({ data: { importSessionId: sessionId, targetType: "STORY_NOTE", targetId: note.id, title: note.title, sortOrder: index } });
      await syncInternalLinks(prisma, { projectId, sourceType: "STORY_NOTE", sourceId: note.id, text: `${note.title}\n${note.body}` });
      created.push({ targetType: "STORY_NOTE", targetId: note.id });
    }
    return created;
  }

  for (const [index, section] of sections.entries()) {
    const text = section.text.trim();
    const research = await prisma.researchNote.create({
      data: {
        title: section.title,
        sourceTitle: resourceOriginalName,
        summary: text,
        personalNotes: "",
        projectId,
        userId,
        resourceLinks: { create: { resourceId, linkType: "RESEARCH_NOTE" } }
      }
    });
    await prisma.pdfImportedItem.create({ data: { importSessionId: sessionId, targetType: "RESEARCH_NOTE", targetId: research.id, title: research.title, sortOrder: index } });
    await syncInternalLinks(prisma, { projectId, sourceType: "RESEARCH_NOTE", sourceId: research.id, text: `${research.title}\n${research.summary}` });
    created.push({ targetType: "RESEARCH_NOTE", targetId: research.id });
  }
  return created;
}

function databaseSetupError() {
  return "The database is not ready yet. Set DATABASE_URL, start PostgreSQL, then run npm run prisma:migrate.";
}

function plainTextToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}
