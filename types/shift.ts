export type NavKey = "today" | "notebook" | "checklist" | "inbox" | "history" | "settings";

export type ItemCategory = "dairy" | "drinks" | "snacks" | "coffee" | "paper goods" | "cleaning" | "other";
export type Unit = "each" | "case" | "bag" | "box" | "tray" | "container";
export type ItemStatus = "stocked" | "running low" | "missing" | "reported" | "restocked";
export type CapturedEntryType = "note" | "task" | "inventory" | "reminder" | "waste" | "maintenance" | "report" | "urgent";
export type CaptureUrgency = "normal" | "soon" | "urgent";

export interface ChecklistItem {
  id: string;
  title: string;
  weight: number;
  done: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  unit: Unit;
  location: string;
  status: ItemStatus;
  quantityNeeded: number;
  quantityOnHand?: number;
  rotating: boolean;
  active: boolean;
  imageUrl?: string;
  notes?: string;
  rotationStartDate?: string;
  expectedEndDate?: string;
  lastSeenAt?: string;
}

export interface UrgentItem {
  id: string;
  name: string;
  quantity: number;
  location: string;
}

export interface NeedNowItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
  source: "manual" | "inventory" | "panic";
  done: boolean;
  createdAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  location: string;
  time: string;
  repeat: "once" | "daily" | "weekdays" | "custom";
  style: "vibration only" | "notification banner" | "both";
  doneToday: boolean;
}

export interface ReportedItem {
  id: string;
  itemId?: string;
  itemName: string;
  reportedAt: string;
  reportedTo: string;
  method: "chat" | "in person" | "radio" | "email" | "other";
  status: "pending" | "ordered" | "restocked" | "no action";
  followUpNeeded: boolean;
  notes?: string;
}

export interface ExpirationBatch {
  id: string;
  itemName: string;
  quantity: number;
  location: string;
  estimate: string;
  status: "okay" | "use soon" | "check today" | "expired";
  notes?: string;
}

export interface WasteObservation {
  id: string;
  itemName: string;
  date: string;
  rating: "low" | "medium" | "high";
  packagingCount?: string;
  trashType: "cardboard" | "plastic" | "mixed" | "food waste" | "other";
  notes?: string;
}

export interface FloorRun {
  id: string;
  location: string;
  checklist: string[];
  startedAt: string;
  minutes: number;
  notes?: string;
}

export interface CapturedEntry {
  id: string;
  rawText: string;
  inferredTypes: CapturedEntryType[];
  location?: string;
  itemName?: string;
  dueText?: string;
  urgency: CaptureUrgency;
  completed: boolean;
  confirmed: boolean;
  dismissed: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Prediction {
  id: string;
  itemName: string;
  location?: string;
  message: string;
  quantityHint?: string;
  reason: string;
  confidence: number;
  createdAt: string;
}

export interface Suggestion {
  id: string;
  type: "reminder" | "checklist" | "routine" | "waste" | "expiration";
  entityId?: string;
  message: string;
  actionLabel: string;
  createdAt: string;
  dismissed?: boolean;
  snoozeUntil?: string;
}

export interface SuggestionDismissal {
  id: string;
  type: string;
  entityId?: string;
  message: string;
  dismissedAt: string;
  snoozeUntil?: string;
}

export interface OcrCleanupResult {
  rawText: string;
  cleanName: string;
  confidence: number;
  category: ItemCategory;
  unit: Unit;
  duplicateItemId?: string;
  duplicateName?: string;
}

export interface WeeklyInsightResult {
  generatedAt: string;
  likelyNeeds: Prediction[];
  reminderSuggestions: Suggestion[];
  checklistSuggestions: Suggestion[];
  mostMissing: Array<{ name: string; count: number }>;
  mostLowStock: Array<{ name: string; count: number }>;
  mostReported: Array<{ name: string; count: number }>;
  pendingReports: ReportedItem[];
  readinessAverage: number;
  readinessBest: number;
  averageFloorMinutes: number;
  fastestFloorRun?: FloorRun;
  wasteWatch: Array<{ itemName: string; count: number; note: string }>;
  expirationRisks: ExpirationBatch[];
  summary: string;
}

export interface ShiftState {
  id: string;
  shiftDate: string;
  updatedAt: string;
  checklist: ChecklistItem[];
  items: InventoryItem[];
  needNow: NeedNowItem[];
  urgent: UrgentItem[];
  reminders: Reminder[];
  reports: ReportedItem[];
  expirations: ExpirationBatch[];
  waste: WasteObservation[];
  floorRuns: FloorRun[];
  capturedEntries: CapturedEntry[];
  smartPromptSkips: string[];
  suggestionDismissals: SuggestionDismissal[];
  predictions: Prediction[];
  insights?: WeeklyInsightResult;
  xp: number;
  settings: {
    smartShiftEnabled: boolean;
    singleUserMode: boolean;
    attendantName: string;
    buildingName: string;
    attendantEmail?: string;
    shiftStartTime: string;
    shiftEndTime: string;
    activeShift: "AM" | "PM";
    amFloors: string[];
    pmFloors: string[];
  };
}
