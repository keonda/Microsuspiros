import { generateWeeklyInsights } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";
import type { ShiftState } from "@/types/shift";

export async function POST(request: Request) {
  try {
    const { state } = await request.json();
    const result = await generateWeeklyInsights(state as ShiftState);
    await logAiEvent("weekly-insights", "success");
    return Response.json({ ok: true, result, provider: process.env.ENABLE_AI_FEATURES === "true" ? process.env.AI_PROVIDER ?? "rules" : "rules" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Insight generation failed";
    await logAiEvent("weekly-insights", "error", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
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
