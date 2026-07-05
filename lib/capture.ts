import type { CapturedEntry, CapturedEntryType, CaptureUrgency, ChecklistItem, NeedNowItem, ShiftState } from "@/types/shift";

export interface CaptureClassification {
  inferredTypes: CapturedEntryType[];
  location?: string;
  itemName?: string;
  dueText?: string;
  urgency: CaptureUrgency;
  completed: boolean;
}

export function classifyCapturedEntry(rawText: string): CaptureClassification {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const types = new Set<CapturedEntryType>(["note"]);
  const location = detectLocation(text);
  const itemName = detectItem(text);
  const dueText = detectDueText(lower);
  let urgency: CaptureUrgency = /urgent|asap|now|emergency|leaking|leak|out of|missing/i.test(text) ? "urgent" : dueText ? "soon" : "normal";
  const completed = /\b(done|finished|completed|restocked|checked|cleaned|threw away|discarded)\b/i.test(text);

  if (/\b(out of|almost out|low|missing|need|restock|stock|forgot)\b/i.test(text)) types.add("inventory");
  if (/\b(need|todo|check|fix|clean|restock|follow up)\b/i.test(text)) types.add("task");
  if (/\b(tomorrow|today|later|morning|afternoon|am|pm|\d{1,2}:\d{2})\b/i.test(text)) types.add("reminder");
  if (/\b(threw away|discarded|expired|waste|trash|boxes|packaging)\b/i.test(text)) types.add("waste");
  if (/\b(leak|leaking|broken|machine|repair|maintenance|clogged)\b/i.test(text)) types.add("maintenance");
  if (/\b(vendor|reported|told|chat|email|radio|forgot|ordered)\b/i.test(text)) types.add("report");
  if (urgency === "urgent") types.add("urgent");

  if (completed) {
    urgency = "normal";
    types.add("task");
  }

  return { inferredTypes: [...types], location, itemName, dueText, urgency, completed };
}

export function createCapturedEntry(rawText: string, now = new Date()): CapturedEntry {
  const classification = classifyCapturedEntry(rawText);
  return {
    id: cryptoSafeId(),
    rawText: rawText.trim(),
    ...classification,
    confirmed: false,
    dismissed: false,
    createdAt: now.toISOString(),
  };
}

export function applyCapturedEntry(state: ShiftState, entry: CapturedEntry): ShiftState {
  let next: ShiftState = {
    ...state,
    capturedEntries: [entry, ...(state.capturedEntries ?? [])],
  };

  if (entry.completed) {
    next = completeChecklistFromCapture(next, entry);
  }

  if (!entry.completed && (entry.inferredTypes.includes("inventory") || entry.inferredTypes.includes("urgent"))) {
    const need: NeedNowItem = {
      id: `capture-${entry.id}`,
      name: entry.itemName || entry.rawText,
      quantity: quantityFromText(entry.rawText),
      unit: "each",
      location: entry.location || "Breakroom",
      source: "manual",
      done: false,
      createdAt: entry.createdAt,
    };
    next = { ...next, needNow: [need, ...(next.needNow ?? [])] };
  }

  return next;
}

export function queueOfflineCapture(queue: CapturedEntry[], entry: CapturedEntry) {
  return [entry, ...queue];
}

export function shouldShowSyncProblem(status: string, online: boolean) {
  return !online || status === "Sync failed";
}

export function confirmCapturedEntry(state: ShiftState, id: string): ShiftState {
  return {
    ...state,
    capturedEntries: state.capturedEntries.map((entry) => entry.id === id ? { ...entry, confirmed: true, updatedAt: new Date().toISOString() } : entry),
  };
}

export function dismissCapturedEntry(state: ShiftState, id: string): ShiftState {
  return {
    ...state,
    capturedEntries: state.capturedEntries.map((entry) => entry.id === id ? { ...entry, dismissed: true, updatedAt: new Date().toISOString() } : entry),
  };
}

export function completeChecklistFromCapture(state: ShiftState, entry: CapturedEntry): ShiftState {
  const tokens = cleanTokens(`${entry.rawText} ${entry.itemName ?? ""} ${entry.location ?? ""}`);
  let changed = false;
  const checklist = state.checklist.map((item: ChecklistItem) => {
    const itemTokens = cleanTokens(item.title);
    const score = itemTokens.filter((token) => tokens.includes(token)).length;
    if (score >= Math.min(2, itemTokens.length) || (tokens.includes("coffee") && itemTokens.includes("coffee"))) {
      changed = true;
      return { ...item, done: true };
    }
    return item;
  });
  return changed ? { ...state, checklist } : state;
}

function detectLocation(text: string) {
  const floor = text.match(/\b(?:floor|fl|f)\s*(\d+)\b/i);
  if (floor) return `Floor ${floor[1]}`;
  const breakroom = text.match(/\bbreakroom\s*([a-z0-9]+)?\b/i);
  if (breakroom) return breakroom[1] ? `Breakroom ${breakroom[1].toUpperCase()}` : "Breakroom";
  return undefined;
}

function detectItem(text: string) {
  const known = ["oat milk", "whole milk", "milk", "coffee bags", "coffee", "yogurt", "cups", "napkins", "trash", "cookies", "coffee machine"];
  const lower = text.toLowerCase();
  return known.find((item) => lower.includes(item))?.replace(/\bbags\b/, "bag");
}

function detectDueText(lower: string) {
  if (lower.includes("tomorrow")) return "tomorrow";
  if (lower.includes("today")) return "today";
  const time = lower.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/);
  return time?.[0];
}

function quantityFromText(text: string) {
  const match = text.match(/\b(\d+)\b/);
  return match ? Math.max(1, Number(match[1])) : 1;
}

function cleanTokens(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((token) => token.length > 1);
}

function cryptoSafeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `capture-${Math.random().toString(36).slice(2)}`;
}
