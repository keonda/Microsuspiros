import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { runGroqChat } from "@/lib/groq";
import { apiError, handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  apiKey: z.string().min(12).optional(),
  model: z.string().min(1).max(80).optional()
});

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await prisma.aiSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    });
    return NextResponse.json({
      settings: {
        hasGroqKey: Boolean(settings.groqApiKeyEncrypted),
        keyLastFour: settings.keyLastFour,
        groqModel: settings.groqModel
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = saveSchema.parse(await request.json());
    const data = {
      groqModel: body.model,
      ...(body.apiKey
        ? {
            groqApiKeyEncrypted: encryptSecret(body.apiKey),
            keyLastFour: body.apiKey.slice(-4)
          }
        : {})
    };
    const settings = await prisma.aiSettings.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data }
    });
    return NextResponse.json({
      settings: {
        hasGroqKey: Boolean(settings.groqApiKeyEncrypted),
        keyLastFour: settings.keyLastFour,
        groqModel: settings.groqModel
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.aiSettings.upsert({
      where: { userId: user.id },
      update: { groqApiKeyEncrypted: null, keyLastFour: null },
      create: { userId: user.id }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const settings = await prisma.aiSettings.findUnique({ where: { userId: user.id } });
    if (!settings?.groqApiKeyEncrypted) return apiError("Save a Groq API key first", 400);
    await runGroqChat(decryptSecret(settings.groqApiKeyEncrypted), settings.groqModel, [
      { role: "system", content: "Reply with a short success message." },
      { role: "user", content: "Test connection." }
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
