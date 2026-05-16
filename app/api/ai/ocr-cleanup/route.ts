import { readFile } from "node:fs/promises";
import { cleanOcrItemName } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";
import { assertSmallEnoughForVision, contentTypeForFile, filenameFromUploadUrl, getUploadPath } from "@/lib/uploads";
import type { InventoryItem } from "@/types/shift";

export async function POST(request: Request) {
  try {
    const { rawText, items, imageUrl } = await request.json();
    const imageDataUrl = await imageUrlToDataUrl(String(imageUrl ?? ""));
    const result = await cleanOcrItemName(String(rawText ?? ""), (items ?? []) as InventoryItem[], imageDataUrl);
    await logAiEvent("ocr-cleanup", "success");
    return Response.json({ ok: true, result, provider: process.env.ENABLE_AI_FEATURES === "true" ? process.env.AI_PROVIDER ?? "rules" : "rules" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR cleanup failed";
    await logAiEvent("ocr-cleanup", "error", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

async function imageUrlToDataUrl(imageUrl: string) {
  if (!imageUrl) return undefined;
  const filename = filenameFromUploadUrl(imageUrl);
  if (!filename) throw new Error("OCR only supports photos uploaded through Shift Companion.");
  const filePath = getUploadPath(filename);
  await assertSmallEnoughForVision(filePath);
  const file = await readFile(filePath);
  return `data:${contentTypeForFile(filename)};base64,${file.toString("base64")}`;
}

async function logAiEvent(feature: string, status: string, error?: string) {
  try {
    await (prisma as any).aiEventLog.create({
      data: { provider: process.env.ENABLE_AI_FEATURES === "true" ? process.env.AI_PROVIDER ?? "rules" : "rules", feature, status, error },
    });
  } catch {
    // Logging should never block a shift workflow.
  }
}
