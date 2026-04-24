"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, ProjectStatus, StoryNoteType } from "@prisma/client";
import { createSession, destroySession, hashPassword, nextRegisteredRole, requireAdmin, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeUpload, validateUpload } from "@/lib/uploads";

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
        ...parsed.data,
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

  await prisma.storyNote.create({ data: { ...parsed, body: parsed.body || "", tagsText: parsed.tagsText || "", projectId, userId: user.id } });
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

  await prisma.researchNote.create({
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
  await prisma.brainstormCard.create({
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

// TODO: AI assistant integration should connect here as project-aware server actions.
// TODO: Version history should snapshot document content before destructive saves.
// TODO: Collaborative writing should replace simple ownership checks with membership/permissions.

function databaseSetupError() {
  return "The database is not ready yet. Set DATABASE_URL, start PostgreSQL, then run npm run prisma:migrate.";
}
