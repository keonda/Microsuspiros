import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const actionNames = [
  "create_site",
  "create_project",
  "create_note",
  "create_task",
  "create_calendar_event",
  "create_quick_link",
  "create_youtube_channel",
  "update_task",
  "update_project",
  "pin_item",
  "archive_item"
] as const;

export const aiActionSchema = z.object({
  intent: z.enum(["none", "action", "follow_up"]),
  action: z.enum(actionNames).nullable().optional(),
  itemType: z.enum(["site", "project", "note", "task", "calendar_event", "quick_link", "youtube_channel"]).nullable().optional(),
  title: z.string().nullable().optional(),
  fields: z.record(z.unknown()).default({}),
  missing: z.array(z.string()).default([]),
  followUp: z.string().nullable().optional()
});

type ParsedAiAction = z.infer<typeof aiActionSchema>;

const nullableString = z.string().trim().optional().nullable().transform((value) => value || null);
const urlField = z.string().trim().url();

const siteFields = z.object({
  name: z.string().trim().min(1),
  url: urlField,
  description: nullableString,
  category: nullableString,
  status: z.enum(["active", "idea", "paused", "archived"]).default("active"),
  icon: nullableString,
  color: nullableString,
  pinned: z.boolean().default(false)
});

const projectFields = z.object({
  name: z.string().trim().min(1),
  description: nullableString,
  status: z.enum(["active", "idea", "paused", "archived", "complete"]).default("active"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  relatedLinks: nullableString,
  notes: nullableString,
  pinned: z.boolean().default(false)
});

const noteFields = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  relatedProject: nullableString,
  pinned: z.boolean().default(false)
});

const taskFields = z.object({
  title: z.string().trim().min(1),
  description: nullableString,
  status: z.enum(["todo", "doing", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: nullableString,
  relatedProject: nullableString,
  pinned: z.boolean().default(false)
});

const eventFields = z.object({
  title: z.string().trim().min(1),
  startsAt: z.string().trim().datetime(),
  endsAt: z.string().trim().datetime().optional().nullable(),
  description: nullableString,
  type: z.enum(["reminder", "content_idea", "upload", "meeting", "personal"]).default("reminder"),
  relatedProject: nullableString,
  pinned: z.boolean().default(false)
});

const linkFields = z.object({
  name: z.string().trim().min(1),
  url: urlField,
  category: nullableString,
  favorite: z.boolean().default(false),
  pinned: z.boolean().default(false)
});

const channelFields = z.object({
  name: z.string().trim().min(1),
  url: urlField,
  description: nullableString,
  nicheMood: nullableString,
  notes: nullableString,
  studioUrl: z.string().trim().url().optional().nullable(),
  analyticsUrl: z.string().trim().url().optional().nullable(),
  pinned: z.boolean().default(false)
});

const updateTaskFields = z.object({
  title: z.string().trim().min(1),
  status: z.enum(["todo", "doing", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  description: nullableString,
  dueDate: nullableString,
  pinned: z.boolean().optional()
});

const updateProjectFields = z.object({
  name: z.string().trim().min(1),
  status: z.enum(["active", "idea", "paused", "archived", "complete"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  description: nullableString,
  notes: nullableString,
  pinned: z.boolean().optional()
});

const pinFields = z.object({
  itemType: z.enum(["site", "project", "note", "task", "calendar_event", "quick_link", "youtube_channel"]),
  name: z.string().trim().min(1)
});

const archiveFields = z.object({
  itemType: z.enum(["site", "project"]),
  name: z.string().trim().min(1)
});

export function previewText(action: ParsedAiAction) {
  const fields = Object.entries(action.fields ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join("\n");
  return [
    "I can prepare this change for you. Please confirm before I save anything.",
    "",
    `Action type: ${action.action}`,
    `Item type: ${action.itemType}`,
    `Title/name: ${action.title}`,
    "Fields detected:",
    fields || "- none"
  ].join("\n");
}

export async function getAssistantActionSettings() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "assistantActionsCreate",
          "assistantActionsUpdate",
          "assistantActionsArchive",
          "assistantActionsCalendar",
          "assistantActionsTask"
        ]
      }
    }
  });
  const get = (key: string) => settings.find((item) => item.key === key)?.value !== "false";
  return {
    create: get("assistantActionsCreate"),
    update: get("assistantActionsUpdate"),
    archive: get("assistantActionsArchive"),
    calendar: get("assistantActionsCalendar"),
    task: get("assistantActionsTask")
  };
}

export async function isActionAllowed(action: string, itemType?: string | null) {
  const settings = await getAssistantActionSettings();
  if (action.startsWith("create_") && !settings.create) return false;
  if (action.startsWith("update_") && !settings.update) return false;
  if ((action === "archive_item" || action === "pin_item") && !settings.archive) return false;
  if ((itemType === "calendar_event" || action === "create_calendar_event") && !settings.calendar) return false;
  if ((itemType === "task" || action === "create_task" || action === "update_task") && !settings.task) return false;
  return true;
}

export async function getConversationWithActions(id: string) {
  return prisma.chatConversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      pendingActions: { where: { status: "pending" }, orderBy: { createdAt: "desc" } }
    }
  });
}

export async function createPendingAiAction(conversationId: string, parsed: ParsedAiAction) {
  if (!parsed.action || !parsed.itemType || !parsed.title) throw new Error("Incomplete action.");
  return prisma.pendingAiAction.create({
    data: {
      conversationId,
      action: parsed.action,
      itemType: parsed.itemType,
      title: parsed.title,
      fields: parsed.fields as Prisma.InputJsonValue
    }
  });
}

async function log(itemType: string, itemName: string, action: string) {
  await prisma.activityLog.create({ data: { itemType, itemName, action } });
}

async function findProjectId(name?: string | null) {
  if (!name) return null;
  const project = await prisma.project.findFirst({
    where: { name: { contains: name, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" }
  });
  return project?.id ?? null;
}

function dateOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function findItem(type: string, name: string) {
  const where = { name: { contains: name, mode: "insensitive" as const } };
  if (type === "site") return prisma.site.findFirst({ where, orderBy: { updatedAt: "desc" } });
  if (type === "project") return prisma.project.findFirst({ where, orderBy: { updatedAt: "desc" } });
  if (type === "youtube_channel") return prisma.youTubeChannel.findFirst({ where, orderBy: { updatedAt: "desc" } });
  if (type === "quick_link") return prisma.quickLink.findFirst({ where, orderBy: { updatedAt: "desc" } });
  if (type === "note") return prisma.note.findFirst({ where: { title: where.name }, orderBy: { updatedAt: "desc" } });
  if (type === "task") return prisma.task.findFirst({ where: { title: where.name }, orderBy: { updatedAt: "desc" } });
  if (type === "calendar_event") return prisma.calendarEvent.findFirst({ where: { title: where.name }, orderBy: { updatedAt: "desc" } });
  return null;
}

export async function applyPendingAiAction(id: string) {
  const pending = await prisma.pendingAiAction.findUnique({ where: { id } });
  if (!pending || pending.status !== "pending") throw new Error("Pending action not found.");
  if (!(await isActionAllowed(pending.action, pending.itemType))) throw new Error("This assistant action type is disabled in settings.");

  const fields = pending.fields as Record<string, unknown>;
  let message = "";

  if (pending.action === "create_site") {
    const data = siteFields.parse({ name: pending.title, ...fields });
    const item = await prisma.site.create({ data });
    await log("Site", item.name, "created by assistant");
    message = `Saved site "${item.name}".`;
  } else if (pending.action === "create_project") {
    const data = projectFields.parse({ name: pending.title, ...fields });
    const item = await prisma.project.create({ data });
    await log("Project", item.name, "created by assistant");
    message = `Saved project "${item.name}".`;
  } else if (pending.action === "create_note") {
    const data = noteFields.parse({ title: pending.title, ...fields });
    const item = await prisma.note.create({ data: { title: data.title, body: data.body, pinned: data.pinned, projectId: await findProjectId(data.relatedProject) } });
    await log("Note", item.title, "created by assistant");
    message = `Saved note "${item.title}".`;
  } else if (pending.action === "create_task") {
    const data = taskFields.parse({ title: pending.title, ...fields });
    const item = await prisma.task.create({ data: { title: data.title, description: data.description, status: data.status, priority: data.priority, dueDate: dateOrNull(data.dueDate), pinned: data.pinned, projectId: await findProjectId(data.relatedProject) } });
    await log("Task", item.title, "created by assistant");
    message = `Saved task "${item.title}".`;
  } else if (pending.action === "create_calendar_event") {
    const data = eventFields.parse({ title: pending.title, ...fields });
    const item = await prisma.calendarEvent.create({ data: { title: data.title, startsAt: new Date(data.startsAt), endsAt: dateOrNull(data.endsAt), description: data.description, type: data.type, pinned: data.pinned, projectId: await findProjectId(data.relatedProject) } });
    await log("CalendarEvent", item.title, "created by assistant");
    message = `Saved calendar event "${item.title}".`;
  } else if (pending.action === "create_quick_link") {
    const data = linkFields.parse({ name: pending.title, ...fields });
    const item = await prisma.quickLink.create({ data });
    await log("QuickLink", item.name, "created by assistant");
    message = `Saved quick link "${item.name}".`;
  } else if (pending.action === "create_youtube_channel") {
    const data = channelFields.parse({ name: pending.title, ...fields });
    const item = await prisma.youTubeChannel.create({ data });
    await log("YouTubeChannel", item.name, "created by assistant");
    message = `Saved YouTube channel "${item.name}".`;
  } else if (pending.action === "update_task") {
    const data = updateTaskFields.parse({ title: pending.title, ...fields });
    const task = await prisma.task.findFirst({ where: { title: { contains: data.title, mode: "insensitive" } }, orderBy: { updatedAt: "desc" } });
    if (!task) throw new Error(`I could not find a task matching "${data.title}".`);
    const item = await prisma.task.update({ where: { id: task.id }, data: { status: data.status, priority: data.priority, description: data.description ?? undefined, dueDate: data.dueDate ? dateOrNull(data.dueDate) : undefined, pinned: data.pinned } });
    await log("Task", item.title, "updated by assistant");
    message = `Updated task "${item.title}".`;
  } else if (pending.action === "update_project") {
    const data = updateProjectFields.parse({ name: pending.title, ...fields });
    const project = await prisma.project.findFirst({ where: { name: { contains: data.name, mode: "insensitive" } }, orderBy: { updatedAt: "desc" } });
    if (!project) throw new Error(`I could not find a project matching "${data.name}".`);
    const item = await prisma.project.update({ where: { id: project.id }, data: { status: data.status, priority: data.priority, description: data.description ?? undefined, notes: data.notes ?? undefined, pinned: data.pinned } });
    await log("Project", item.name, "updated by assistant");
    message = `Updated project "${item.name}".`;
  } else if (pending.action === "pin_item") {
    const data = pinFields.parse({ name: pending.title, ...fields });
    const item = await findItem(data.itemType, data.name);
    if (!item) throw new Error(`I could not find ${data.itemType} matching "${data.name}".`);
    await updatePinned(data.itemType, item.id, true);
    await log(data.itemType, data.name, "pinned by assistant");
    message = `Pinned "${data.name}" to the dashboard.`;
  } else if (pending.action === "archive_item") {
    const data = archiveFields.parse({ name: pending.title, ...fields });
    const item = await findItem(data.itemType, data.name);
    if (!item) throw new Error(`I could not find ${data.itemType} matching "${data.name}".`);
    await updateStatus(data.itemType, item.id, "archived");
    await log(data.itemType, data.name, "archived by assistant");
    message = `Archived "${data.name}".`;
  } else {
    throw new Error("Unsupported action.");
  }

  await prisma.pendingAiAction.update({ where: { id }, data: { status: "confirmed", resultMessage: message } });
  await prisma.chatMessage.create({ data: { conversationId: pending.conversationId, role: "assistant", content: message } });
  return { conversationId: pending.conversationId, message };
}

async function updatePinned(type: string, id: string, pinned: boolean) {
  if (type === "site") return prisma.site.update({ where: { id }, data: { pinned } });
  if (type === "project") return prisma.project.update({ where: { id }, data: { pinned } });
  if (type === "note") return prisma.note.update({ where: { id }, data: { pinned } });
  if (type === "task") return prisma.task.update({ where: { id }, data: { pinned } });
  if (type === "calendar_event") return prisma.calendarEvent.update({ where: { id }, data: { pinned } });
  if (type === "quick_link") return prisma.quickLink.update({ where: { id }, data: { pinned } });
  if (type === "youtube_channel") return prisma.youTubeChannel.update({ where: { id }, data: { pinned } });
  throw new Error("Unsupported pin item type.");
}

async function updateStatus(type: string, id: string, status: "archived") {
  if (type === "site") return prisma.site.update({ where: { id }, data: { status } });
  if (type === "project") return prisma.project.update({ where: { id }, data: { status } });
  throw new Error("Only sites and projects can be archived.");
}
