import { prisma } from "@/lib/prisma";
import { mergeShiftSnapshots } from "@/lib/sync-merge";
import type { ShiftState } from "@/types/shift";

function singleUserEmail() {
  return String(process.env.SINGLE_USER_EMAIL ?? "attendant@example.com").trim().replace(/^["']|["']$/g, "").toLowerCase();
}

export async function GET() {
  const db = prisma as any;
  try {
    const user = await db.user.findUnique({ where: { email: singleUserEmail() } });
    if (!user) return Response.json({ ok: true, snapshot: null });

    const setting = await db.appSetting.findUnique({
      where: { userId_key: { userId: user.id, key: "offlineSnapshot" } },
    });

    return Response.json({ ok: true, snapshot: setting?.value ?? null });
  } catch (error) {
    console.error("Sync pull failed", error);
    return Response.json({ ok: false, error: "Sync pull failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = prisma as any;
  try {
    const { events } = await request.json();
    if (!Array.isArray(events)) return Response.json({ ok: false, error: "events array required" }, { status: 400 });

    const lastEvent = events.at(-1);
    if (!lastEvent?.payload) return Response.json({ ok: true, applied: 0 });

    const payload = lastEvent.payload;
    const incomingUpdatedAt = Date.parse(payload.updatedAt ?? "");
    const user = await db.user.upsert({
      where: { email: singleUserEmail() },
      update: {},
      create: { email: singleUserEmail(), name: "Shift attendant" },
    });

    const existingSetting = await db.appSetting.findUnique({
      where: { userId_key: { userId: user.id, key: "offlineSnapshot" } },
    });
    const existingSnapshot = existingSetting?.value as { updatedAt?: string } | null | undefined;
    const existingUpdatedAt = Date.parse(existingSnapshot?.updatedAt ?? "");

    if (Number.isFinite(existingUpdatedAt) && Number.isFinite(incomingUpdatedAt) && incomingUpdatedAt < existingUpdatedAt) {
      return Response.json({ ok: true, applied: 0, ignored: events.length, snapshot: existingSetting.value });
    }

    await db.shift.upsert({
      where: { id: payload.id },
      update: { date: new Date(payload.shiftDate), notes: "Synced from offline client" },
      create: { id: payload.id, userId: user.id, date: new Date(payload.shiftDate), notes: "Synced from offline client" },
    });

    const existingFullSnapshot = existingSetting?.value as ShiftState | null | undefined;
    const nextSnapshot = existingFullSnapshot
      ? mergeShiftSnapshots(existingFullSnapshot, payload as ShiftState)
      : payload;

    await db.appSetting.upsert({
      where: { userId_key: { userId: user.id, key: "offlineSnapshot" } },
      update: { value: nextSnapshot },
      create: { userId: user.id, key: "offlineSnapshot", value: nextSnapshot },
    });

    return Response.json({ ok: true, applied: events.length, snapshot: nextSnapshot });
  } catch (error) {
    console.error("Sync push failed", error);
    return Response.json({ ok: false, error: "Sync push failed" }, { status: 500 });
  }
}
