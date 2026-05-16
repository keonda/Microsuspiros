import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const db = prisma as any;
  const { events } = await request.json();
  if (!Array.isArray(events)) return Response.json({ ok: false, error: "events array required" }, { status: 400 });

  const lastEvent = events.at(-1);
  if (!lastEvent?.payload) return Response.json({ ok: true, applied: 0 });

  const payload = lastEvent.payload;
  const user = await db.user.upsert({
    where: { email: process.env.SINGLE_USER_EMAIL ?? "attendant@example.com" },
    update: {},
    create: { email: process.env.SINGLE_USER_EMAIL ?? "attendant@example.com", name: "Shift attendant" },
  });

  await db.shift.upsert({
    where: { id: payload.id },
    update: { date: new Date(payload.shiftDate), notes: "Synced from offline client" },
    create: { id: payload.id, userId: user.id, date: new Date(payload.shiftDate), notes: "Synced from offline client" },
  });

  await db.appSetting.upsert({
    where: { userId_key: { userId: user.id, key: "offlineSnapshot" } },
    update: { value: payload },
    create: { userId: user.id, key: "offlineSnapshot", value: payload },
  });

  return Response.json({ ok: true, applied: events.length });
}
