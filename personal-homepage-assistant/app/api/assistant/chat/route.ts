import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiActionSchema, createPendingAiAction, getConversationWithActions, isActionAllowed, parseLocalAssistantAction, previewText } from "@/lib/ai-actions";
import { requireUser } from "@/lib/auth";
import { getAssistantContext } from "@/lib/context";
import { prisma } from "@/lib/prisma";
import { getAppTimeZone } from "@/lib/timezone";

export async function POST(request: NextRequest) {
  await requireUser();
  const body = z.object({
    conversationId: z.string().nullable().optional(),
    message: z.string().min(1).max(8000),
    useDashboardContext: z.boolean().default(true)
  }).parse(await request.json());

  const settings = await prisma.setting.findMany({ where: { key: { in: ["groqApiKey", "groqModel"] } } });
  const apiKey = settings.find((item) => item.key === "groqApiKey")?.value;
  const model = settings.find((item) => item.key === "groqModel")?.value ?? "llama-3.1-8b-instant";
  if (!apiKey) {
    return NextResponse.json({ error: "Add your Groq API key in Settings first." }, { status: 400 });
  }

  const conversation = body.conversationId
    ? await prisma.chatConversation.findUnique({ where: { id: body.conversationId }, include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } } })
    : await prisma.chatConversation.create({
        data: { title: body.message.slice(0, 64), useDashboardContext: body.useDashboardContext },
        include: { messages: true }
      });

  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  await prisma.chatMessage.create({ data: { conversationId: conversation.id, role: "user", content: body.message } });
  await prisma.chatConversation.update({ where: { id: conversation.id }, data: { useDashboardContext: body.useDashboardContext } });
  const dashboardContext = body.useDashboardContext ? await getAssistantContext() : "Dashboard context disabled.";
  const timeZone = await getAppTimeZone();

  const parsedAction =
    parseLocalAssistantAction(body.message, timeZone) ??
    (await parseAssistantAction({
      apiKey,
      model,
      message: body.message,
      dashboardContext,
      timeZone
    }));

  if (parsedAction.intent === "follow_up") {
    const followUp = parsedAction.followUp || `I need one detail first: ${parsedAction.missing.join(", ")}.`;
    await prisma.chatMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: followUp } });
    return NextResponse.json({ conversation: await getConversationWithActions(conversation.id) });
  }

  if (parsedAction.intent === "action" && parsedAction.action && parsedAction.itemType && parsedAction.title) {
    if (!(await isActionAllowed(parsedAction.action, parsedAction.itemType))) {
      await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: "That assistant action type is disabled in Settings. I did not prepare a database change."
        }
      });
      return NextResponse.json({ conversation: await getConversationWithActions(conversation.id) });
    }

    await createPendingAiAction(conversation.id, parsedAction);
    await prisma.chatMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: previewText(parsedAction) } });
    return NextResponse.json({ conversation: await getConversationWithActions(conversation.id) });
  }

  const system = [
    "You are a private personal homepage assistant.",
    "Answer only from the user's request and provided internal dashboard context when context is enabled.",
    "When you refer to internal data, cite the item by its exact name in parentheses, such as (Project: MicroSuspiros).",
    "You cannot create, update, pin, archive, or save records in normal chat. If asked to do that and no confirmation card appears, say you could not prepare the action and ask the user to try again.",
    "Never claim that you updated internal dashboard context or saved a new task/site/project/note/link/event unless the server confirmed it.",
    "Be practical, concise, and help the user decide what to do next."
  ].join(" ");

  const history = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 20
  });

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "system", content: `Internal dashboard context JSON:\n${dashboardContext}` },
        ...history.map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }))
      ],
      temperature: 0.4,
      max_tokens: 1200
    })
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `Groq request failed: ${text}` }, { status: 502 });
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content ?? "I could not generate a response.";
  await prisma.chatMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: answer } });

  const fresh = await getConversationWithActions(conversation.id);

  return NextResponse.json({ conversation: fresh });
}

async function parseAssistantAction({
  apiKey,
  model,
  message,
  dashboardContext,
  timeZone
}: {
  apiKey: string;
  model: string;
  message: string;
  dashboardContext: string;
  timeZone: string;
}) {
  const today = new Date().toISOString();
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: [
            "You convert user messages into JSON for a private dashboard app.",
            "Return only JSON matching this shape:",
            '{"intent":"none|action|follow_up","action":"create_site|create_project|create_note|create_task|create_calendar_event|create_quick_link|create_youtube_channel|update_task|update_project|pin_item|archive_item|null","itemType":"site|project|note|task|calendar_event|quick_link|youtube_channel|null","title":"string|null","fields":{},"missing":[],"followUp":"string|null"}',
            "Use intent none for ordinary questions or requests that do not imply a database change.",
            "Use follow_up only when a required field is missing. Keep followUp short.",
            "Never claim the action was saved. This parser only prepares a pending action.",
            "Required create fields: site needs name and url; project needs name; note needs title and body; task needs title; calendar event needs title and startsAt ISO datetime; quick link needs name and url; YouTube channel needs name and url.",
            "For relative dates, infer an ISO datetime from today's ISO date. If too ambiguous, ask follow_up.",
            "For update_task, include title plus fields to change. For update_project, include name plus fields to change.",
            "For pin_item/archive_item, include fields.itemType and fields.name.",
            `Today is ${today}. The user's configured timezone is ${timeZone}.`
          ].join(" ")
        },
        { role: "system", content: `Dashboard context for matching existing item names:\n${dashboardContext}` },
        { role: "user", content: message }
      ]
    })
  });

  if (!response.ok) {
    return { intent: "none", fields: {}, missing: [] } as const;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return aiActionSchema.parse(normalizeParsedAction(JSON.parse(content)));
  } catch {
    return { intent: "none", fields: {}, missing: [] } as const;
  }
}

function normalizeParsedAction(raw: any) {
  const fields = raw?.fields && typeof raw.fields === "object" ? { ...raw.fields } : {};
  let action = raw?.action;
  let itemType = raw?.itemType;

  if (action === "create_event") action = "create_calendar_event";
  if (itemType === "event") itemType = "calendar_event";
  if (fields.itemType === "event") fields.itemType = "calendar_event";
  if (fields.date && !fields.startsAt) fields.startsAt = fields.date;
  if (fields.name && !raw.title) raw.title = fields.name;
  if (fields.title && !raw.title) raw.title = fields.title;

  return { ...raw, action, itemType, fields };
}
