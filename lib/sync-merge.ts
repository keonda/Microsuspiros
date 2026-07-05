import type { CapturedEntry, NeedNowItem, ShiftState } from "@/types/shift";

export function mergeShiftSnapshots(base: ShiftState, incoming: ShiftState): ShiftState {
  return {
    ...incoming,
    needNow: mergeNeedNow(base.needNow ?? [], incoming.needNow ?? []),
    capturedEntries: mergeCapturedEntries(base.capturedEntries ?? [], incoming.capturedEntries ?? []),
  };
}

export function mergeNeedNow(localItems: NeedNowItem[], remoteItems: NeedNowItem[]) {
  const byId = new Map<string, NeedNowItem>();
  for (const item of remoteItems) byId.set(item.id, item);
  for (const item of localItems) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, newerNeedNow(existing, item));
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function newerNeedNow(a: NeedNowItem, b: NeedNowItem) {
  if (a.done !== b.done) return b.done ? b : a;
  return Date.parse(b.createdAt) >= Date.parse(a.createdAt) ? b : a;
}

export function mergeCapturedEntries(localItems: CapturedEntry[], remoteItems: CapturedEntry[]) {
  const byId = new Map<string, CapturedEntry>();
  for (const item of remoteItems) byId.set(item.id, item);
  for (const item of localItems) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? newerCapturedEntry(existing, item) : item);
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function newerCapturedEntry(a: CapturedEntry, b: CapturedEntry) {
  const aTime = Date.parse(a.updatedAt ?? a.createdAt);
  const bTime = Date.parse(b.updatedAt ?? b.createdAt);
  return bTime >= aTime ? b : a;
}
