import type { NeedNowItem, ShiftState } from "@/types/shift";

export function mergeShiftSnapshots(base: ShiftState, incoming: ShiftState): ShiftState {
  return {
    ...incoming,
    needNow: mergeNeedNow(base.needNow ?? [], incoming.needNow ?? []),
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
