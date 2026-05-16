import { z } from "zod";

export const ItemNameCleanupResultSchema = z.object({
  rawText: z.string(),
  cleanName: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.enum(["dairy", "drinks", "snacks", "coffee", "paper goods", "cleaning", "other"]),
  unit: z.enum(["each", "case", "bag", "box", "tray", "container"]),
  duplicateItemId: z.string().optional(),
  duplicateName: z.string().optional(),
});

export const ReminderSuggestionResultSchema = z.object({
  suggestions: z.array(z.object({
    type: z.literal("reminder"),
    entityId: z.string().optional(),
    message: z.string(),
    actionLabel: z.string(),
  })),
});

export const ChecklistSuggestionResultSchema = z.object({
  suggestions: z.array(z.object({
    type: z.literal("checklist"),
    entityId: z.string().optional(),
    message: z.string(),
    actionLabel: z.string(),
  })),
});

export const WeeklyInsightResultSchema = z.object({
  summary: z.string(),
  likelyNeeds: z.array(z.object({
    itemName: z.string(),
    location: z.string().optional(),
    message: z.string(),
    quantityHint: z.string().optional(),
    reason: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  wasteWatch: z.array(z.object({
    itemName: z.string(),
    count: z.number(),
    note: z.string(),
  })),
});

export type ItemNameCleanupContract = z.infer<typeof ItemNameCleanupResultSchema>;
