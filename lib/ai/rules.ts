import type {
  ChecklistItem,
  InventoryItem,
  OcrCleanupResult,
  Prediction,
  Reminder,
  ShiftState,
  Suggestion,
  WeeklyInsightResult,
} from "@/types/shift";
import { duplicateCandidates, getReadiness } from "@/lib/shift-logic";

const ABBREVIATIONS: Record<string, string> = {
  CHOC: "chocolate",
  CHIP: "chip",
  COOKIE: "cookie",
  COOKIES: "cookies",
  ORG: "organic",
  WHL: "whole",
  GAL: "gallon",
  OZ: "ounce",
  PK: "pack",
  EA: "each",
  CT: "count",
  YOG: "yogurt",
};

export function cleanOcrWithRules(rawText: string, items: InventoryItem[]): OcrCleanupResult {
  const raw = rawText.trim();
  const expanded = raw
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^\d+$/.test(token) && !["CASE", "2OZ", "1GAL"].includes(token))
    .map((token) => ABBREVIATIONS[token] ?? token.toLowerCase());

  let cleanName = titleCase(expanded.join(" ").replace(/\bchip cookie\b/i, "chip cookies"));
  if (!cleanName) cleanName = raw;

  const candidates = duplicateCandidates(cleanName, items);
  const duplicate = candidates[0];
  if (duplicate && duplicate.name.toLowerCase().includes("cookie")) cleanName = duplicate.name;

  return {
    rawText: raw,
    cleanName,
    confidence: duplicate ? 0.86 : 0.68,
    category: inferCategory(cleanName),
    unit: inferUnit(raw),
    duplicateItemId: duplicate?.id,
    duplicateName: duplicate?.name,
  };
}

export function predictShortagesWithRules(state: ShiftState, now = new Date()): Prediction[] {
  const createdAt = now.toISOString();
  const predictions: Prediction[] = [];
  const pendingReports = state.reports.filter((report) => report.status === "pending");

  for (const report of pendingReports) {
    predictions.push({
      id: `pending-${slug(report.itemName)}`,
      itemName: report.itemName,
      message: `${report.itemName} is still pending from reports.`,
      reason: "reported pending",
      confidence: 0.9,
      createdAt,
    });
  }

  for (const item of state.items) {
    if (item.status === "missing" || item.status === "running low") {
      predictions.push({
        id: `status-${item.id}`,
        itemName: item.name,
        location: item.location,
        quantityHint: item.quantityNeeded ? `+${item.quantityNeeded} ${item.unit}` : undefined,
        message: `${item.name} is currently ${item.status}${item.location ? ` at ${item.location}` : ""}.`,
        reason: "current inventory status",
        confidence: item.status === "missing" ? 0.92 : 0.78,
        createdAt,
      });
    }
  }

  for (const batch of state.expirations.filter((entry) => entry.status === "use soon" || entry.status === "check today")) {
    predictions.push({
      id: `expiration-${slug(batch.itemName)}`,
      itemName: batch.itemName,
      location: batch.location,
      message: `${batch.itemName} needs a FIFO/date check${batch.estimate ? ` (${batch.estimate})` : ""}.`,
      reason: "expiration watch",
      confidence: 0.74,
      createdAt,
    });
  }

  const coffeeReminder = state.reminders.find((reminder) => /coffee/i.test(reminder.title) && reminder.time >= "08:00" && reminder.time <= "09:00");
  if (coffeeReminder) {
    predictions.push({
      id: "routine-coffee-830",
      itemName: "Coffee",
      location: coffeeReminder.location,
      message: `Coffee is usually checked around ${formatTime(coffeeReminder.time)}${coffeeReminder.location ? ` at ${coffeeReminder.location}` : ""}.`,
      reason: "routine reminder timing",
      confidence: 0.65,
      createdAt,
    });
  }

  return uniqueBy(predictions, (prediction) => `${prediction.itemName}-${prediction.reason}`).slice(0, 6);
}

export function suggestRemindersWithRules(state: ShiftState, now = new Date()): Suggestion[] {
  const dismissed = activeDismissals(state, now);
  const suggestions: Suggestion[] = [];
  const hasCoffeeReminder = state.reminders.some((reminder) => /coffee/i.test(reminder.title) && reminder.time >= "08:00" && reminder.time <= "09:00");
  if (!hasCoffeeReminder && !dismissed.has("reminder:coffee")) {
    suggestions.push({
      id: "suggest-reminder-coffee",
      type: "reminder",
      entityId: "coffee",
      message: "Floor coffee is often checked between 8:00 and 9:00. Create a weekday reminder?",
      actionLabel: "Add reminder",
      createdAt: now.toISOString(),
    });
  }

  const yogurtNeeds = state.items.some((item) => /yogurt/i.test(item.name) && (item.status === "missing" || item.status === "running low"));
  if (yogurtNeeds && !dismissed.has("reminder:yogurt")) {
    suggestions.push({
      id: "suggest-reminder-yogurt",
      type: "reminder",
      entityId: "yogurt",
      message: "Yogurts are showing up as a need. Add a quiet weekday check?",
      actionLabel: "Add reminder",
      createdAt: now.toISOString(),
    });
  }

  return suggestions;
}

export function suggestChecklistWithRules(state: ShiftState, now = new Date()): Suggestion[] {
  const dismissed = activeDismissals(state, now);
  const suggestions: Suggestion[] = [];
  const hasFloorCoffee = state.checklist.some((item) => /floor.*coffee|coffee.*floor/i.test(item.title));
  if (!hasFloorCoffee && state.reminders.some((reminder) => /coffee/i.test(reminder.title)) && !dismissed.has("checklist:floor-coffee")) {
    suggestions.push({
      id: "suggest-checklist-floor-coffee",
      type: "checklist",
      entityId: "floor-coffee",
      message: "You often check floor coffee. Add it to opening readiness?",
      actionLabel: "Add to checklist",
      createdAt: now.toISOString(),
    });
  }

  const skipped = state.checklist.filter((item) => !item.done);
  if (getReadiness(state.checklist) < 80 && skipped.length > 3 && !dismissed.has("checklist:weights")) {
    suggestions.push({
      id: "suggest-checklist-weights",
      type: "checklist",
      entityId: "weights",
      message: "Opening is under 80%. Consider lowering weight on tasks often skipped until later.",
      actionLabel: "Review checklist",
      createdAt: now.toISOString(),
    });
  }

  return suggestions;
}

export function weeklyInsightsWithRules(state: ShiftState, now = new Date()): WeeklyInsightResult {
  const readiness = getReadiness(state.checklist);
  const likelyNeeds = predictShortagesWithRules(state, now);
  const wasteWatch = detectWasteHeavyItems(state);
  const mostMissing = countItems(state.items.filter((item) => item.status === "missing").map((item) => item.name));
  const mostLowStock = countItems(state.items.filter((item) => item.status === "running low").map((item) => item.name));
  const mostReported = countItems(state.reports.map((report) => report.itemName));
  const averageFloorMinutes = state.floorRuns.length ? Math.round(state.floorRuns.reduce((sum, run) => sum + run.minutes, 0) / state.floorRuns.length) : 0;
  const fastestFloorRun = [...state.floorRuns].sort((a, b) => a.minutes - b.minutes)[0];
  const pendingReports = state.reports.filter((report) => report.status === "pending" && daysSince(report.reportedAt, now) >= 2);
  const expirationRisks = state.expirations.filter((entry) => entry.status !== "okay");

  const summary = [
    "Weekly Shift Companion Summary:",
    "",
    "Most common low-stock items:",
    ...(mostLowStock.length ? mostLowStock.map((item) => `- ${item.name} — ${item.count} time${item.count === 1 ? "" : "s"}`) : ["- None yet"]),
    "",
    "Pending:",
    ...(pendingReports.length ? pendingReports.map((report) => `- ${report.itemName} — reported ${daysSince(report.reportedAt, now)} days ago`) : ["- None older than 2 days"]),
    "",
    "Opening readiness:",
    `- Average ${readiness}%, best ${readiness}%`,
    "",
    "Waste observations:",
    ...(wasteWatch.length ? wasteWatch.map((watch) => `- ${watch.itemName} marked high waste ${watch.count} time${watch.count === 1 ? "" : "s"}`) : ["- No waste-heavy patterns yet"]),
  ].join("\n");

  return {
    generatedAt: now.toISOString(),
    likelyNeeds,
    reminderSuggestions: suggestRemindersWithRules(state, now),
    checklistSuggestions: suggestChecklistWithRules(state, now),
    mostMissing,
    mostLowStock,
    mostReported,
    pendingReports,
    readinessAverage: readiness,
    readinessBest: readiness,
    averageFloorMinutes,
    fastestFloorRun,
    wasteWatch,
    expirationRisks,
    summary,
  };
}

export function detectWasteHeavyItems(state: ShiftState) {
  return countItems(state.waste.filter((entry) => entry.rating === "high").map((entry) => entry.itemName))
    .filter((entry) => entry.count >= 3 || /box|boxes|daily|one day/i.test(state.waste.find((waste) => waste.itemName === entry.name)?.notes ?? ""))
    .map((entry) => ({
      itemName: entry.name,
      count: entry.count,
      note: `${entry.name} has repeated high packaging waste observations. Treat as a watch item, not an exact measurement.`,
    }));
}

export function applySuggestion(state: ShiftState, suggestion: Suggestion): ShiftState {
  if (suggestion.type === "reminder") {
    const title = suggestion.entityId === "yogurt" ? "Check yogurts" : "Check coffee on 6th floor";
    if (state.reminders.some((reminder) => reminder.title.toLowerCase() === title.toLowerCase())) return state;
    const reminder: Reminder = {
      id: cryptoSafeId(),
      title,
      location: suggestion.entityId === "yogurt" ? "Breakroom" : "Floor 6",
      time: suggestion.entityId === "yogurt" ? "09:15" : "08:30",
      repeat: "weekdays",
      style: "notification banner",
      doneToday: false,
    };
    return { ...state, reminders: [reminder, ...state.reminders] };
  }

  if (suggestion.type === "checklist" && suggestion.entityId === "floor-coffee") {
    if (state.checklist.some((item) => /floor.*coffee|coffee.*floor/i.test(item.title))) return state;
    const checklistItem: ChecklistItem = { id: cryptoSafeId(), title: "Check floor coffee", weight: 10, done: false };
    return { ...state, checklist: [...state.checklist, checklistItem] };
  }

  return state;
}

function inferCategory(text: string): OcrCleanupResult["category"] {
  if (/milk|yogurt|cheese/i.test(text)) return "dairy";
  if (/coffee/i.test(text)) return "coffee";
  if (/cookie|snack|chip|bar/i.test(text)) return "snacks";
  if (/cup|napkin|plate/i.test(text)) return "paper goods";
  if (/clean|soap|wipe/i.test(text)) return "cleaning";
  if (/water|soda|drink|celsius|juice/i.test(text)) return "drinks";
  return "other";
}

function inferUnit(raw: string): OcrCleanupResult["unit"] {
  if (/case/i.test(raw)) return "case";
  if (/box|ct/i.test(raw)) return "box";
  if (/bag/i.test(raw)) return "bag";
  if (/tray/i.test(raw)) return "tray";
  if (/container/i.test(raw)) return "container";
  return "each";
}

function activeDismissals(state: ShiftState, now: Date) {
  return new Set(
    (state.suggestionDismissals ?? [])
      .filter((dismissal) => !dismissal.snoozeUntil || new Date(dismissal.snoozeUntil) > now)
      .map((dismissal) => `${dismissal.type}:${dismissal.entityId ?? slug(dismissal.message)}`),
  );
}

function countItems(names: string[]) {
  const counts = new Map<string, number>();
  names.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function daysSince(value: string, now: Date) {
  return Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000);
}

function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(2020, 1, 1, hour, minute).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function titleCase(text: string) {
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/\bOz|Gallon|Count\b/g, (word) => word.toLowerCase());
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function cryptoSafeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}`;
}
