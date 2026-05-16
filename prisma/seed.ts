import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const db = prisma as any;

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SINGLE_USER_PASSWORD ?? "shiftcompanion", 10);
  const user = await db.user.upsert({
    where: { email: process.env.SINGLE_USER_EMAIL ?? "attendant@example.com" },
    update: { passwordHash },
    create: { email: process.env.SINGLE_USER_EMAIL ?? "attendant@example.com", name: "Shift attendant", passwordHash },
  });

  const locations = ["Floor 3", "Floor 6", "Floor 8", "Main storage", "Breakroom A"];
  for (const [index, name] of locations.entries()) {
    await db.location.upsert({
      where: { name },
      update: { sortOrder: index },
      create: { name, sortOrder: index },
    });
  }

  const breakroom = await db.location.findUniqueOrThrow({ where: { name: "Breakroom A" } });
  const floor6 = await db.location.findUniqueOrThrow({ where: { name: "Floor 6" } });
  const storage = await db.location.findUniqueOrThrow({ where: { name: "Main storage" } });

  const items = [
    ["Whole milk", "DAIRY", "CASE", breakroom.id],
    ["Oat milk", "DAIRY", "CASE", breakroom.id],
    ["Plain yogurt", "DAIRY", "EACH", breakroom.id],
    ["Mango yogurt", "DAIRY", "EACH", breakroom.id],
    ["Cheese sticks", "DAIRY", "CONTAINER", breakroom.id],
    ["Chocolate chip cookies", "SNACKS", "BOX", storage.id],
    ["Coffee", "COFFEE", "BAG", floor6.id],
    ["Cups", "PAPER_GOODS", "CASE", breakroom.id],
    ["Napkins", "PAPER_GOODS", "CASE", breakroom.id],
    ["Oxxo snacks", "SNACKS", "BOX", storage.id],
  ] as const;

  for (const [name, category, unit, defaultLocationId] of items) {
    await db.item.upsert({
      where: { id: slug(name) },
      update: { category, unit, defaultLocationId },
      create: {
        id: slug(name),
        name,
        category,
        unit,
        defaultLocationId,
        quantityNeeded: name.includes("yogurt") ? 10 : name.includes("milk") ? 2 : 1,
        rotating: name.includes("Mango") || name.includes("cookies"),
        lastSeenDate: new Date(),
      },
    });
  }

  const checklist = [
    ["Brew coffee", 25],
    ["Check milk", 15],
    ["Check yogurts", 10],
    ["Check cups", 10],
    ["Check napkins", 5],
    ["Check floor 6 coffee", 15],
    ["Check snacks", 10],
    ["Final walk-through", 10],
  ] as const;

  for (const [index, [title, weight]] of checklist.entries()) {
    await db.checklistItem.upsert({
      where: { id: slug(title) },
      update: { title, weight, sortOrder: index },
      create: { id: slug(title), title, weight, sortOrder: index },
    });
  }

  await db.reminder.createMany({
    data: [
      { userId: user.id, title: "Check coffee on 6th floor", locationId: floor6.id, time: "08:30", repeat: "WEEKDAYS", style: "BOTH" },
      { userId: user.id, title: "Check yogurts", locationId: breakroom.id, time: "09:15", repeat: "WEEKDAYS", style: "NOTIFICATION_BANNER" },
      { userId: user.id, title: "Final fridge check", locationId: breakroom.id, time: "11:30", repeat: "DAILY", style: "VIBRATION_ONLY" },
    ],
    skipDuplicates: true,
  });

  for (const name of ["Coffee Guardian", "Milk Rescuer", "Cookie Watcher", "Fridge Master", "Opening Hero", "Panic Mode Survivor", "Fast Floor Run"]) {
    await db.badge.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} badge` },
    });
  }

  const milk = await db.item.findUniqueOrThrow({ where: { id: "whole-milk" } });
  const coffee = await db.item.findUniqueOrThrow({ where: { id: "coffee" } });
  const cookies = await db.item.findUniqueOrThrow({ where: { id: "chocolate-chip-cookies" } });
  const oxxo = await db.item.findUniqueOrThrow({ where: { id: "oxxo-snacks" } });
  const yogurt = await db.item.findUniqueOrThrow({ where: { id: "plain-yogurt" } });
  const mondayDates = previousMondays(3);

  for (const date of mondayDates) {
    const shift = await db.shift.upsert({
      where: { id: `seed-shift-${date.toISOString().slice(0, 10)}` },
      update: {},
      create: { id: `seed-shift-${date.toISOString().slice(0, 10)}`, userId: user.id, date, notes: "Seeded Phase 2 pattern data" },
    });
    await db.inventoryEntry.create({
      data: { shiftId: shift.id, itemId: milk.id, status: "MISSING", quantityNeeded: 2, createdAt: setTime(date, 8, 20) },
    });
    await db.inventoryEntry.create({
      data: { shiftId: shift.id, itemId: coffee.id, status: "RESTOCKED", quantityNeeded: 1, createdAt: setTime(date, 8, 30) },
    });
    await db.floorRun.create({
      data: { shiftId: shift.id, location: "Floor 6", checklist: ["coffee", "cups", "snacks"], startedAt: setTime(date, 8, 25), minutes: 12 + mondayDates.indexOf(date) },
    });
  }

  await db.reportedItem.create({
    data: {
      userId: user.id,
      itemId: cookies.id,
      itemName: "Chocolate chip cookies",
      reportedAt: new Date(Date.now() - 3 * 86_400_000),
      reportedTo: "Team chat",
      method: "CHAT",
      status: "PENDING",
      followUpNeeded: true,
    },
  });

  for (let index = 0; index < 3; index += 1) {
    await db.wasteObservation.create({
      data: {
        itemId: oxxo.id,
        itemName: "Oxxo snacks",
        date: new Date(Date.now() - index * 86_400_000),
        rating: "HIGH",
        packagingCount: "5 boxes",
        trashType: "CARDBOARD",
        notes: "5 boxes filled one small container and lasted about one day.",
      },
    });
  }

  await db.expirationBatch.create({
    data: { itemId: yogurt.id, itemName: "Plain yogurt", quantity: 10, location: "Breakroom A", estimate: "this week", status: "USE_SOON", notes: "Seeded yogurt expiration risk" },
  });
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function previousMondays(count: number) {
  const dates: Date[] = [];
  const today = new Date();
  const diff = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diff);
  for (let index = 0; index < count; index += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() - index * 7);
    dates.push(date);
  }
  return dates;
}

function setTime(date: Date, hour: number, minute: number) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
