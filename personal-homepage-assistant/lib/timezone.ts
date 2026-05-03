import { prisma } from "@/lib/prisma";

export const defaultTimeZone = "America/Los_Angeles";

export function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function getAppTimeZone() {
  const setting = await prisma.setting.findUnique({ where: { key: "timeZone" } });
  return setting?.value && isValidTimeZone(setting.value) ? setting.value : defaultTimeZone;
}

export function zonedDateAtHour(timeZone: string, offsetDays: number, hour = 9) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const base = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + offsetDays, hour, 0, 0));
  const offset = getTimeZoneOffsetMinutes(base, timeZone);
  return new Date(base.getTime() - offset * 60000);
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return (asUtc - date.getTime()) / 60000;
}
