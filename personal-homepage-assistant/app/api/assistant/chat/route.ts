import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getAssistantContext } from "@/lib/context";
import { prisma } from "@/lib/prisma";

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

  const system = [
    "You are a private personal homepage assistant.",
    "Answer only from the user's request and provided internal dashboard context when context is enabled.",
    "When you refer to internal data, cite the item by its exact name in parentheses, such as (Project: MicroSuspiros).",
    "Be practical, concise, and help the user decide what to do next."
  ].join(" ");

  const dashboardContext = body.useDashboardContext ? await getAssistantContext() : "Dashboard context disabled.";
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

  const fresh = await prisma.chatConversation.findUnique({
    where: { id: conversation.id },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });

  return NextResponse.json({ conversation: fresh });
}
