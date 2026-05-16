import type { ChecklistItem, InventoryItem, ShiftState } from "@/types/shift";

export function createDefaultState(): ShiftState {
  const now = new Date().toISOString();
  return {
    id: cryptoSafeId(),
    shiftDate: now.slice(0, 10),
    updatedAt: now,
    checklist: [
      { id: "brew-coffee", title: "Brew coffee", weight: 25, done: false },
      { id: "check-milk", title: "Check milk", weight: 15, done: false },
      { id: "check-yogurts", title: "Check yogurts", weight: 10, done: false },
      { id: "check-cups", title: "Check cups", weight: 10, done: false },
      { id: "check-napkins", title: "Check napkins", weight: 5, done: false },
      { id: "floor-6-coffee", title: "Check floor 6 coffee", weight: 15, done: false },
      { id: "check-snacks", title: "Check snacks", weight: 10, done: false },
      { id: "walk-through", title: "Final walk-through", weight: 10, done: false },
    ],
    items: [
      item("Whole milk", "dairy", "case", "Breakroom A", 2),
      item("Oat milk", "dairy", "case", "Breakroom A", 1),
      item("Plain yogurt", "dairy", "each", "Breakroom A", 10),
      item("Mango yogurt", "dairy", "each", "Breakroom A", 10, true),
      item("Cheese sticks", "dairy", "container", "Breakroom A", 1),
      item("Chocolate chip cookies", "snacks", "box", "Main storage", 2, true),
      item("Coffee", "coffee", "bag", "Floor 6", 1),
      item("Cups", "paper goods", "case", "Breakroom A", 1),
      item("Napkins", "paper goods", "case", "Breakroom A", 1),
    ],
    needNow: [],
    urgent: [],
    reminders: [
      { id: "rem-coffee-6", title: "Check coffee on 6th floor", location: "Floor 6", time: "08:30", repeat: "weekdays", style: "both", doneToday: false },
      { id: "rem-yogurts", title: "Check yogurts", location: "Breakroom A", time: "09:15", repeat: "weekdays", style: "notification banner", doneToday: false },
      { id: "rem-fridge", title: "Final fridge check", location: "Breakroom A", time: "11:30", repeat: "daily", style: "vibration only", doneToday: false },
    ],
    reports: [],
    expirations: [],
    waste: [],
    floorRuns: [],
    smartPromptSkips: [],
    suggestionDismissals: [],
    predictions: [],
    xp: 0,
    settings: {
      smartShiftEnabled: true,
      singleUserMode: true,
      attendantName: "",
      buildingName: "Breakroom",
      attendantEmail: "",
      shiftStartTime: "07:00",
      shiftEndTime: "12:00",
      activeShift: "AM",
      amFloors: ["Floor 3", "Floor 6"],
      pmFloors: ["Floor 3", "Floor 6", "Floor 8"],
    },
  };
}

function item(
  name: string,
  category: InventoryItem["category"],
  unit: InventoryItem["unit"],
  location: string,
  quantityNeeded: number,
  rotating = false,
): InventoryItem {
  return {
    id: slug(name),
    name,
    category,
    unit,
    location,
    status: "stocked",
    quantityNeeded,
    rotating,
    active: true,
    lastSeenAt: new Date().toISOString(),
  };
}

export function getReadiness(checklist: ChecklistItem[]) {
  const total = checklist.reduce((sum, item) => sum + Math.max(0, item.weight), 0) || 1;
  const done = checklist.reduce((sum, item) => sum + (item.done ? Math.max(0, item.weight) : 0), 0);
  return Math.round((done / total) * 100);
}

export function getReadinessLabel(score: number) {
  if (score < 50) return "Needs attention";
  if (score < 80) return "Almost there";
  if (score < 95) return "Ready enough";
  return "Ready for opening";
}

export function smartPromptFor(state: ShiftState, now: Date) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const skipped = new Set(state.smartPromptSkips);
  const coffee = state.checklist.find((item) => item.id === "brew-coffee");
  const floorCoffee = state.checklist.find((item) => item.id === "floor-6-coffee");
  const oldPending = state.reports.find((report) => report.status === "pending" && daysSince(report.reportedAt, now) >= 2);
  const checkToday = state.expirations.find((item) => item.status === "check today" || item.status === "expired");

  if (state.reminders.some((reminder) => !reminder.doneToday && reminder.time <= timeNow(now))) {
    const reminder = state.reminders.find((entry) => !entry.doneToday && entry.time <= timeNow(now));
    if (reminder && !skipped.has(`reminder-${reminder.id}`)) {
      return {
        id: `reminder-${reminder.id}`,
        text: reminder.title,
        actions: [
          { label: "Done", kind: "reminder-done", reminderId: reminder.id },
          { label: "Later", kind: "later" },
          { label: "Skip", kind: "skip" },
        ],
      };
    }
  }

  if (getReadiness(state.checklist) < 80 && !skipped.has("readiness-under-80")) {
    return {
      id: "readiness-under-80",
      text: "Opening checklist is still under 80%. Knock out one more quick check?",
      actions: [
        { label: "Open checklist", kind: "later" },
        { label: "Skip", kind: "skip" },
      ],
    };
  }

  if (checkToday && !skipped.has(`expiration-${checkToday.id}`)) {
    return {
      id: `expiration-${checkToday.id}`,
      text: `${checkToday.itemName} needs an expiration check today.`,
      actions: [
        { label: "Done", kind: "later" },
        { label: "Skip", kind: "skip" },
      ],
    };
  }

  if (oldPending && !skipped.has(`pending-${oldPending.id}`)) {
    return {
      id: `pending-${oldPending.id}`,
      text: `${oldPending.itemName} has been pending for ${daysSince(oldPending.reportedAt, now)} days.`,
      actions: [
        { label: "Follow up", kind: "later" },
        { label: "Skip", kind: "skip" },
      ],
    };
  }

  const likelyNeed = state.items.find((item) => item.status === "missing" || item.status === "running low");
  if (likelyNeed && !skipped.has(`likely-${likelyNeed.id}`)) {
    return {
      id: `likely-${likelyNeed.id}`,
      text: `${likelyNeed.name} is ${likelyNeed.status}${likelyNeed.location ? ` at ${likelyNeed.location}` : ""}.`,
      actions: [
        { label: "Add need", kind: "later" },
        { label: "Skip", kind: "skip" },
      ],
    };
  }

  if (hour >= 5 && hour < 8 && coffee && !coffee.done && !skipped.has("brew-coffee")) {
    return {
      id: "brew-coffee",
      text: "Brewed coffee yet?",
      actions: [
        { label: "Yes", kind: "done", checklistId: coffee.id },
        { label: "Later", kind: "later" },
        { label: "Skip", kind: "skip" },
      ],
    };
  }

  if ((hour === 8 && minute >= 25) || (hour === 9 && minute <= 10)) {
    if (floorCoffee && !floorCoffee.done && !skipped.has("floor-6-coffee")) {
      return {
        id: "floor-6-coffee",
        text: "Check coffee on 6th floor?",
        actions: [
          { label: "Done", kind: "done", checklistId: floorCoffee.id },
          { label: "Later", kind: "later" },
          { label: "Skip", kind: "skip" },
        ],
      };
    }
  }

  if ((hour < 5 || hour > 14) && !skipped.has("outside-flow")) {
    return {
      id: "outside-flow",
      text: "You opened Shift Companion outside your usual flow. Did something need attention?",
      actions: [
        { label: "Brewed coffee", kind: "done", checklistId: coffee?.id },
        { label: "Low item", kind: "later" },
        { label: "Skip", kind: "skip" },
      ],
    };
  }

  return null;
}

function timeNow(now: Date) {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function daysSince(value: string, now: Date) {
  return Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000);
}

export function makeSummary(state: ShiftState, kind: "normal" | "urgent" | "missing" | "low" | "end") {
  const missing = state.items.filter((item) => item.status === "missing");
  const low = state.items.filter((item) => item.status === "running low");
  const reported = state.reports.filter((item) => item.status === "pending");
  const readiness = getReadiness(state.checklist);

  if (kind === "urgent") {
    return ["URGENT RESTOCK NEEDED:", ...state.urgent.map((item) => `- ${item.name} — ${item.quantity}${item.location ? `, ${item.location}` : ""}`)].join("\n");
  }

  if (kind === "missing") return ["Missing:", ...missing.map((item) => `- ${item.name} — ${item.quantityNeeded} ${item.unit}`)].join("\n");
  if (kind === "low") return ["Running low:", ...low.map((item) => `- ${item.name}`)].join("\n");
  if (kind === "end") {
    return [
      "End of shift notes:",
      "Completed:",
      `- Opening checklist ${readiness}%`,
      ...state.checklist.filter((item) => item.done).slice(0, 5).map((item) => `- ${item.title}`),
      "",
      "Pending:",
      ...[...missing, ...low].map((item) => `- ${item.name} still ${item.status}`),
      ...state.expirations.filter((item) => item.status !== "okay").map((item) => `- ${item.itemName} expires ${item.estimate}`),
    ].join("\n");
  }

  return [
    "Today's breakroom update:",
    "",
    "Missing:",
    ...(missing.length ? missing.map((item) => `- ${item.name} — ${item.quantityNeeded} ${item.unit}`) : ["- None"]),
    "",
    "Running low:",
    ...(low.length ? low.map((item) => `- ${item.name}`) : ["- None"]),
    "",
    "Reported:",
    ...(reported.length ? reported.map((item) => `- ${item.itemName} — reported at ${new Date(item.reportedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`) : ["- None"]),
    "",
    "Needs check:",
    ...state.reminders.filter((item) => !item.doneToday).slice(0, 3).map((item) => `- ${item.title} at ${item.time}`),
  ].join("\n");
}

export function duplicateCandidates(text: string, items: InventoryItem[]) {
  const tokens = cleanTokens(text);
  if (!tokens.length) return [];
  return items
    .map((item) => ({ item, score: cleanTokens(item.name).filter((token) => tokens.includes(token)).length }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

function cleanTokens(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((token) => token.length > 2);
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function cryptoSafeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}`;
}
