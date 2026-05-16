import type { InventoryItem, OcrCleanupResult, ShiftState, WeeklyInsightResult } from "@/types/shift";
import { ItemNameCleanupResultSchema, WeeklyInsightResultSchema } from "@/lib/ai/contracts";
import { cleanOcrWithRules, weeklyInsightsWithRules } from "@/lib/ai/rules";
import { runGroqJson, runGroqVisionJson } from "@/lib/ai/groq";
import { runGeminiJson } from "@/lib/ai/gemini";
import { runOpenAiJson } from "@/lib/ai/openai";

type JsonFeature = "ocr-cleanup" | "weekly-insights";

function aiEnabled() {
  return process.env.ENABLE_AI_FEATURES === "true" && process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "none";
}

async function runJson(feature: JsonFeature, prompt: string) {
  if (!aiEnabled()) return null;
  const provider = process.env.AI_PROVIDER;
  if (provider === "groq") return runGroqJson(prompt);
  if (provider === "gemini") return runGeminiJson(prompt);
  if (provider === "openai") return runOpenAiJson(prompt);
  return null;
}

export async function cleanOcrItemName(rawText: string, items: InventoryItem[], imageDataUrl?: string): Promise<OcrCleanupResult> {
  const fallback = cleanOcrWithRules(rawText, items);
  const prompt = [
    imageDataUrl ? "Read the product label in the image, then return strict JSON for inventory label cleanup." : "Return strict JSON for an inventory label cleanup.",
    "Schema fields: rawText, cleanName, confidence 0-1, category, unit, optional duplicateItemId, duplicateName.",
    "Allowed category values: dairy, drinks, snacks, coffee, paper goods, cleaning, other.",
    "Allowed unit values: each, case, bag, box, tray, container.",
    `Raw text: ${rawText}`,
    `Existing items: ${items.map((item) => `${item.id}:${item.name}`).join(", ")}`,
  ].join("\n");

  try {
    if (imageDataUrl && aiEnabled() && process.env.AI_PROVIDER === "groq") {
      const json = await runGroqVisionJson(prompt, imageDataUrl);
      if (!json) return fallback;
      return ItemNameCleanupResultSchema.parse(json);
    }
    const json = await runJson("ocr-cleanup", prompt);
    if (!json) return fallback;
    return ItemNameCleanupResultSchema.parse(json);
  } catch {
    return fallback;
  }
}

export async function generateWeeklyInsights(state: ShiftState): Promise<WeeklyInsightResult> {
  const fallback = weeklyInsightsWithRules(state);
  const prompt = [
    "Return strict JSON for weekly breakroom insights.",
    "Schema fields: summary, likelyNeeds[], wasteWatch[]. Keep it concise and operational.",
    JSON.stringify({
      items: state.items.map(({ name, status, quantityNeeded, location }) => ({ name, status, quantityNeeded, location })),
      reports: state.reports.map(({ itemName, reportedAt, status }) => ({ itemName, reportedAt, status })),
      waste: state.waste.map(({ itemName, date, rating, packagingCount, notes }) => ({ itemName, date, rating, packagingCount, notes })),
      expirations: state.expirations.map(({ itemName, estimate, status }) => ({ itemName, estimate, status })),
    }),
  ].join("\n");

  try {
    const json = await runJson("weekly-insights", prompt);
    if (!json) return fallback;
    const parsed = WeeklyInsightResultSchema.parse(json);
    return { ...fallback, summary: parsed.summary };
  } catch {
    return fallback;
  }
}
