import { prisma } from "@/lib/prisma";

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
    const user = await db.user.upsert({
      where: { email: singleUserEmail() },
      update: {},
      create: { email: singleUserEmail(), name: "Shift attendant" },
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

    return Response.json({ ok: true, applied: events.length, snapshot: payload });
  } catch (error) {
    console.error("Sync push failed", error);
    return Response.json({ ok: false, error: "Sync push failed" }, { status: 500 });
  }
}
