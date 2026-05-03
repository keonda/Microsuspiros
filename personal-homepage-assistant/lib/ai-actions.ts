import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requestMovie, requestSeries } from "@/lib/integrations";
import { defaultTimeZone, zonedDateAtHour, zonedDateForMonthDay } from "@/lib/timezone";

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
  "archive_item",
  "request_series",
  "request_movie"
] as const;

export const aiActionSchema = z.object({
  intent: z.enum(["none", "action", "follow_up"]),
  action: z.enum(actionNames).nullable().optional(),
  itemType: z.enum(["site", "project", "note", "task", "calendar_event", "quick_link", "youtube_channel", "media_request"]).nullable().optional(),
  title: z.string().nullable().optional(),
  fields: z.record(z.unknown()).default({}),
  missing: z.array(z.string()).default([]),
  followUp: z.string().nullable().optional()
});

export type ParsedAiAction = z.infer<typeof aiActionSchema>;

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

const mediaRequestFields = z.object({
  title: z.string().trim().min(1),
  mediaType: z.enum(["anime", "tv", "movie"])
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
  if ((action === "request_series" || action === "request_movie") && !settings.create) return false;
  if (action.startsWith("update_") && !settings.update) return false;
  if ((action === "archive_item" || action === "pin_item") && !settings.archive) return false;
  if ((itemType === "calendar_event" || action === "create_calendar_event") && !settings.calendar) return false;
  if ((itemType === "task" || action === "create_task" || action === "update_task") && !settings.task) return false;
  return true;
}

export function parseLocalAssistantAction(message: string, timeZone = defaultTimeZone): ParsedAiAction | null {
  const text = message.trim();
  const lower = text.toLowerCase();
  const dueDate = inferDueDate(text, timeZone);

  if (/\b(request|add|grab|download|monitor)\b/i.test(text) && /\b(anime|show|series|tv|movie|film)\b/i.test(text)) {
    const mediaType = lower.includes("movie") || lower.includes("film") ? "movie" : lower.includes("anime") ? "anime" : "tv";
    const title = cleanupTitle(text.replace(/\b(request|add|grab|download|monitor)\b/gi, "").replace(/\b(anime|show|series|tv|movie|film)\b/gi, ""));
    if (!title) return followUp("What title should I request?", ["title"]);
    return aiActionSchema.parse({
      intent: "action",
      action: mediaType === "movie" ? "request_movie" : "request_series",
      itemType: "media_request",
      title,
      fields: { title, mediaType },
      missing: []
    });
  }

  if (/^(add|create|make)\s+(a\s+)?task\b/i.test(text)) {
    const rawTitle = cleanupTitle(text.replace(/^(add|create|make)\s+(a\s+)?task\s*(to|for|called|named)?\s*/i, ""));
    if (!rawTitle) return followUp("What should the task be called?", ["title"]);
    return aiActionSchema.parse({
      intent: "action",
      action: "create_task",
      itemType: "task",
      title: rawTitle,
      fields: {
        title: rawTitle,
        description: rawTitle,
        status: "todo",
        priority: priorityFromText(lower),
        dueDate
      },
      missing: []
    });
  }

  if (/^(add|create)\s+(a\s+)?project\b/i.test(text)) {
    const rawTitle = cleanupTitle(text.replace(/^(add|create)\s+(a\s+)?project\s*(called|named)?\s*/i, ""));
    if (!rawTitle) return followUp("What should the project be called?", ["name"]);
    return aiActionSchema.parse({
      intent: "action",
      action: "create_project",
      itemType: "project",
      title: rawTitle,
      fields: { name: rawTitle, status: "active", priority: priorityFromText(lower) },
      missing: []
    });
  }

  if (/^(add|create)\s+(a\s+)?note\b/i.test(text)) {
    const body = cleanupTitle(text.replace(/^(add|create)\s+(a\s+)?note\s*(about|called|named)?\s*/i, ""));
    if (!body) return followUp("What should the note say?", ["body"]);
    const title = titleCase(body.slice(0, 70));
    return aiActionSchema.parse({
      intent: "action",
      action: "create_note",
      itemType: "note",
      title,
      fields: { title, body },
      missing: []
    });
  }

  if (/^(add|create)\s+(a\s+)?(site|website)\b/i.test(text) || /\bas a site\b/i.test(text)) {
    const foundUrl = extractUrl(text);
    const name = cleanupTitle(text.replace(/^(add|create)\s+(a\s+)?(site|website)\s*/i, "").replace(/\bas a site\.?$/i, "").replace(foundUrl ?? "", ""));
    if (!foundUrl) return followUp("What URL should I use for the site?", ["url"]);
    const finalName = name || domainName(foundUrl);
    return aiActionSchema.parse({
      intent: "action",
      action: "create_site",
      itemType: "site",
      title: finalName,
      fields: { name: finalName, url: normalizeUrl(foundUrl), status: "active" },
      missing: []
    });
  }

  if (/^(add|create)\s+(to\s+)?(a\s+)?(calendar\s+)?event\b/i.test(text)) {
    const startsAt = dueDate ?? inferMonthDayDate(text, timeZone);
    const title = cleanupTitle(stripDateFromTitle(text.replace(/^(add|create)\s+(to\s+)?(a\s+)?(calendar\s+)?event\s*(for|called|named)?\s*,?\s*/i, "")));
    if (!title) return followUp("What should the event be called?", ["title"]);
    if (!startsAt) return followUp("When should I schedule it?", ["startsAt"]);
    return aiActionSchema.parse({
      intent: "action",
      action: "create_calendar_event",
      itemType: "calendar_event",
      title,
      fields: { title, startsAt, type: eventTypeFromText(lower), description: title },
      missing: []
    });
  }

  if (/^(add|save)\s+(this\s+)?link\b/i.test(text) || /^(add|save).*\bhttps?:\/\//i.test(text)) {
    const foundUrl = extractUrl(text);
    if (!foundUrl) return followUp("What URL should I save?", ["url"]);
    const name = cleanupTitle(text.replace(/^(add|save)\s+(this\s+)?link\s*(to|as|called|named)?\s*/i, "").replace(foundUrl, "")) || domainName(foundUrl);
    return aiActionSchema.parse({
      intent: "action",
      action: "create_quick_link",
      itemType: "quick_link",
      title: name,
      fields: { name, url: normalizeUrl(foundUrl), category: categoryFromText(text), favorite: false },
      missing: []
    });
  }

  if (/^(add|create)\s+(a\s+)?(youtube\s+)?channel\b/i.test(text)) {
    const foundUrl = extractUrl(text);
    const name = cleanupTitle(text.replace(/^(add|create)\s+(a\s+)?(youtube\s+)?channel\s*(called|named)?\s*/i, "").replace(foundUrl ?? "", ""));
    if (!foundUrl) return followUp("What URL should I use for the YouTube channel?", ["url"]);
    const finalName = name || domainName(foundUrl);
    return aiActionSchema.parse({
      intent: "action",
      action: "create_youtube_channel",
      itemType: "youtube_channel",
      title: finalName,
      fields: { name: finalName, url: normalizeUrl(foundUrl) },
      missing: []
    });
  }

  if (/\b(mark|update|set)\b.*\btask\b.*\b(done|doing|todo)\b/i.test(text)) {
    const status = lower.includes("done") ? "done" : lower.includes("doing") ? "doing" : "todo";
    const title = cleanupTitle(text.replace(/\b(mark|update|set)\b/i, "").replace(/\b(task|as|to|done|doing|todo)\b/gi, ""));
    if (!title) return followUp("Which task should I update?", ["title"]);
    return aiActionSchema.parse({
      intent: "action",
      action: "update_task",
      itemType: "task",
      title,
      fields: { title, status },
      missing: []
    });
  }

  if (/\b(mark|update|set)\b.*\bproject\b.*\b(paused|active|archived|complete)\b/i.test(text)) {
    const status = lower.includes("paused") ? "paused" : lower.includes("archived") ? "archived" : lower.includes("complete") ? "complete" : "active";
    const name = cleanupTitle(text.replace(/\b(mark|update|set)\b/i, "").replace(/\b(project|as|to|paused|active|archived|complete)\b/gi, ""));
    if (!name) return followUp("Which project should I update?", ["name"]);
    return aiActionSchema.parse({
      intent: "action",
      action: "update_project",
      itemType: "project",
      title: name,
      fields: { name, status },
      missing: []
    });
  }

  if (/^pin\b/i.test(text)) {
    const itemType = itemTypeFromText(lower);
    const name = cleanupTitle(text.replace(/^pin\s*/i, "").replace(/\b(site|project|note|task|event|calendar event|link|channel|youtube channel|to the dashboard|on the dashboard)\b/gi, ""));
    if (!itemType || !name) return followUp("Which item should I pin?", ["itemType", "name"]);
    return aiActionSchema.parse({
      intent: "action",
      action: "pin_item",
      itemType,
      title: name,
      fields: { itemType, name },
      missing: []
    });
  }

  if (/^(archive|pause)\b/i.test(text)) {
    const itemType = lower.includes("site") ? "site" : lower.includes("project") ? "project" : null;
    const name = cleanupTitle(text.replace(/^(archive|pause)\s*/i, "").replace(/\b(site|project)\b/gi, ""));
    if (!itemType || !name) return followUp("Which site or project should I archive?", ["itemType", "name"]);
    return aiActionSchema.parse({
      intent: "action",
      action: "archive_item",
      itemType,
      title: name,
      fields: { itemType, name },
      missing: []
    });
  }

  return null;
}

function followUp(followUp: string, missing: string[]): ParsedAiAction {
  return { intent: "follow_up", action: null, itemType: null, title: null, fields: {}, missing, followUp };
}

function cleanupTitle(value: string) {
  return value
    .replace(/\b(today|tomorrow|this weekend|next week)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^["'\s:.-]+|["'\s:.-]+$/g, "")
    .trim();
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function extractUrl(value: string) {
  return value.match(/https?:\/\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i)?.[0]?.replace(/[.,;)]$/, "") ?? null;
}

function normalizeUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function domainName(value: string) {
  return normalizeUrl(value).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
}

function priorityFromText(value: string) {
  if (/\b(urgent|asap)\b/.test(value)) return "urgent";
  if (/\b(high|important)\b/.test(value)) return "high";
  if (/\b(low|someday)\b/.test(value)) return "low";
  return "medium";
}

function inferDueDate(value: string, timeZone: string) {
  const lower = value.toLowerCase();
  if (lower.includes("tomorrow")) return zonedDateAtHour(timeZone, 1).toISOString();
  else if (lower.includes("today")) return new Date().toISOString();
  else if (lower.includes("this weekend")) {
    const jsDay = new Date().getDay();
    return zonedDateAtHour(timeZone, (6 - jsDay + 7) % 7 || 7).toISOString();
  } else if (lower.includes("next week")) return zonedDateAtHour(timeZone, 7).toISOString();
  else return null;
}

function inferMonthDayDate(value: string, timeZone: string) {
  const match = value.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})\b/i);
  if (!match) return null;
  const month = monthNumber(match[1]);
  const day = Number(match[2]);
  if (!month || day < 1 || day > 31) return null;
  return zonedDateForMonthDay(timeZone, month, day).toISOString();
}

function stripDateFromTitle(value: string) {
  return value.replace(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\b,?\s*/i, "");
}

function monthNumber(value: string) {
  const month = value.slice(0, 3).toLowerCase();
  return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(month) + 1;
}

function eventTypeFromText(value: string) {
  if (value.includes("upload")) return "upload";
  if (value.includes("meeting")) return "meeting";
  if (value.includes("content idea")) return "content_idea";
  if (value.includes("personal")) return "personal";
  return "reminder";
}

function categoryFromText(value: string) {
  const match = value.match(/\bto my ([a-z0-9\s-]+)$/i);
  return match?.[1]?.trim() ?? null;
}

function itemTypeFromText(value: string) {
  if (value.includes("youtube channel") || value.includes("channel")) return "youtube_channel";
  if (value.includes("calendar event") || value.includes("event")) return "calendar_event";
  if (value.includes("site")) return "site";
  if (value.includes("project")) return "project";
  if (value.includes("note")) return "note";
  if (value.includes("task")) return "task";
  if (value.includes("link")) return "quick_link";
  return null;
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
  } else if (pending.action === "request_series") {
    const data = mediaRequestFields.parse({ title: pending.title, ...fields });
    message = await requestSeries(data.title, data.mediaType === "anime");
    await log("MediaRequest", data.title, "requested in Sonarr");
  } else if (pending.action === "request_movie") {
    const data = mediaRequestFields.parse({ title: pending.title, ...fields });
    message = await requestMovie(data.title);
    await log("MediaRequest", data.title, "requested in Radarr");
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
