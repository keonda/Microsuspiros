"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { createSession, hasAdminUser, requireUser } from "@/lib/auth";
import { defaultTimeZone, isValidTimeZone } from "@/lib/timezone";

const nonEmpty = z.string().trim().min(1);
const optionalText = z.string().trim().optional().transform((v) => v || null);
const url = z.string().trim().url();

function boolFromForm(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function maybeDate(value: string) {
  return value ? new Date(value) : null;
}

async function log(itemType: string, itemName: string, action: string) {
  await prisma.activityLog.create({ data: { itemType, itemName, action } });
}

export async function setupAdmin(formData: FormData) {
  if (await hasAdminUser()) redirect("/login");
  const schema = z.object({
    name: optionalText,
    email: z.string().trim().email(),
    password: z.string().min(10)
  });
  const parsed = schema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password")
  });
  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      passwordHash: await hashPassword(parsed.password),
      isAdmin: true
    }
  });
  await createSession(user.id);
  redirect("/dashboard");
}

export async function login(_: unknown, formData: FormData) {
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password did not match." };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function saveSite(formData: FormData) {
  await requireUser();
  const data = z.object({
    id: z.string().optional(),
    name: nonEmpty,
    url,
    description: optionalText,
    category: optionalText,
    status: z.enum(["active", "idea", "paused", "archived"]),
    icon: optionalText,
    color: optionalText
  }).parse(Object.fromEntries(formData));
  const item = await prisma.site.upsert({
    where: { id: data.id || "__new__" },
    create: { ...data, id: undefined, pinned: boolFromForm(formData.get("pinned")) },
    update: { ...data, id: undefined, pinned: boolFromForm(formData.get("pinned")) }
  });
  await log("Site", item.name, data.id ? "updated" : "created");
  redirect("/sites");
}

export async function saveChannel(formData: FormData) {
  await requireUser();
  const data = z.object({
    id: z.string().optional(),
    name: nonEmpty,
    url,
    description: optionalText,
    nicheMood: optionalText,
    notes: optionalText,
    studioUrl: z.string().trim().url().optional().or(z.literal("")).transform((v) => v || null),
    analyticsUrl: z.string().trim().url().optional().or(z.literal("")).transform((v) => v || null)
  }).parse(Object.fromEntries(formData));
  const item = await prisma.youTubeChannel.upsert({
    where: { id: data.id || "__new__" },
    create: { ...data, id: undefined, pinned: boolFromForm(formData.get("pinned")) },
    update: { ...data, id: undefined, pinned: boolFromForm(formData.get("pinned")) }
  });
  await log("YouTubeChannel", item.name, data.id ? "updated" : "created");
  redirect("/channels");
}

export async function saveProject(formData: FormData) {
  await requireUser();
  const data = z.object({
    id: z.string().optional(),
    name: nonEmpty,
    description: optionalText,
    status: z.enum(["active", "idea", "paused", "archived", "complete"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    relatedLinks: optionalText,
    notes: optionalText
  }).parse(Object.fromEntries(formData));
  const item = await prisma.project.upsert({
    where: { id: data.id || "__new__" },
    create: { ...data, id: undefined, pinned: boolFromForm(formData.get("pinned")) },
    update: { ...data, id: undefined, pinned: boolFromForm(formData.get("pinned")) }
  });
  await log("Project", item.name, data.id ? "updated" : "created");
  redirect("/projects");
}

export async function saveNote(formData: FormData) {
  await requireUser();
  const data = z.object({
    id: z.string().optional(),
    title: nonEmpty,
    body: z.string(),
    projectId: z.string().optional().transform((v) => v || null)
  }).parse(Object.fromEntries(formData));
  const item = await prisma.note.upsert({
    where: { id: data.id || "__new__" },
    create: { ...data, id: undefined, pinned: boolFromForm(formData.get("pinned")) },
    update: { ...data, id: undefined, pinned: boolFromForm(formData.get("pinned")) }
  });
  await log("Note", item.title, data.id ? "updated" : "created");
  redirect("/notes");
}

export async function saveTask(formData: FormData) {
  await requireUser();
  const data = z.object({
    id: z.string().optional(),
    title: nonEmpty,
    description: optionalText,
    status: z.enum(["todo", "doing", "done"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    projectId: z.string().optional().transform((v) => v || null)
  }).parse(Object.fromEntries(formData));
  const dueDate = maybeDate(str(formData, "dueDate"));
  const item = await prisma.task.upsert({
    where: { id: data.id || "__new__" },
    create: { ...data, id: undefined, dueDate, pinned: boolFromForm(formData.get("pinned")) },
    update: { ...data, id: undefined, dueDate, pinned: boolFromForm(formData.get("pinned")) }
  });
  await log("Task", item.title, data.id ? "updated" : "created");
  redirect("/tasks");
}

export async function completeTask(formData: FormData) {
  await requireUser();
  const id = str(formData, "id");
  const item = await prisma.task.update({ where: { id }, data: { status: "done" } });
  await log("Task", item.title, "completed");
  redirect("/dashboard");
}

export async function saveEvent(formData: FormData) {
  await requireUser();
  const data = z.object({
    id: z.string().optional(),
    title: nonEmpty,
    description: optionalText,
    type: z.enum(["reminder", "content_idea", "upload", "meeting", "personal"]),
    projectId: z.string().optional().transform((v) => v || null)
  }).parse(Object.fromEntries(formData));
  const startsAt = maybeDate(str(formData, "startsAt"));
  if (!startsAt) throw new Error("Start date is required.");
  const endsAt = maybeDate(str(formData, "endsAt"));
  const item = await prisma.calendarEvent.upsert({
    where: { id: data.id || "__new__" },
    create: { ...data, id: undefined, startsAt, endsAt, pinned: boolFromForm(formData.get("pinned")) },
    update: { ...data, id: undefined, startsAt, endsAt, pinned: boolFromForm(formData.get("pinned")) }
  });
  await log("CalendarEvent", item.title, data.id ? "updated" : "created");
  redirect("/calendar");
}

export async function saveQuickLink(formData: FormData) {
  await requireUser();
  const data = z.object({
    id: z.string().optional(),
    name: nonEmpty,
    url,
    category: optionalText
  }).parse(Object.fromEntries(formData));
  const item = await prisma.quickLink.upsert({
    where: { id: data.id || "__new__" },
    create: { ...data, id: undefined, favorite: boolFromForm(formData.get("favorite")), pinned: boolFromForm(formData.get("pinned")) },
    update: { ...data, id: undefined, favorite: boolFromForm(formData.get("favorite")), pinned: boolFromForm(formData.get("pinned")) }
  });
  await log("QuickLink", item.name, data.id ? "updated" : "created");
  redirect("/links");
}

export async function deleteItem(formData: FormData) {
  await requireUser();
  const type = str(formData, "type");
  const id = str(formData, "id");
  const table = {
    site: prisma.site,
    channel: prisma.youTubeChannel,
    project: prisma.project,
    note: prisma.note,
    task: prisma.task,
    event: prisma.calendarEvent,
    link: prisma.quickLink
  }[type] as { delete: (args: { where: { id: string } }) => Promise<unknown> } | undefined;
  if (!table) throw new Error("Unknown item type.");
  await table.delete({ where: { id } });
  await log(type, id, "deleted");
}

export async function saveSettings(formData: FormData) {
  await requireUser();
  const groqKey = str(formData, "groqApiKey");
  const model = str(formData, "groqModel") || "llama-3.1-8b-instant";
  const timeZone = str(formData, "timeZone") || defaultTimeZone;
  if (!isValidTimeZone(timeZone)) throw new Error("Invalid timezone.");
  if (groqKey) {
    await prisma.setting.upsert({
      where: { key: "groqApiKey" },
      create: { key: "groqApiKey", value: groqKey, secret: true },
      update: { value: groqKey, secret: true }
    });
  }
  await prisma.setting.upsert({
    where: { key: "groqModel" },
    create: { key: "groqModel", value: model },
    update: { value: model }
  });
  await prisma.setting.upsert({
    where: { key: "timeZone" },
    create: { key: "timeZone", value: timeZone },
    update: { value: timeZone }
  });
  const toggles = [
    "assistantActionsCreate",
    "assistantActionsUpdate",
    "assistantActionsArchive",
    "assistantActionsCalendar",
    "assistantActionsTask"
  ];
  for (const key of toggles) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: boolFromForm(formData.get(key)) ? "true" : "false" },
      update: { value: boolFromForm(formData.get(key)) ? "true" : "false" }
    });
  }
  redirect("/settings?saved=1");
}
