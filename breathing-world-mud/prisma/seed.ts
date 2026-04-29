import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "change-me-now";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isAdmin: true },
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      displayName: "World Keeper",
      isAdmin: true
    }
  });

  await prisma.appSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" }
  });

  const candleGate = await prisma.room.upsert({
    where: { slug: "the-candle-gate" },
    update: {},
    create: {
      name: "The Candle Gate",
      slug: "the-candle-gate",
      description: "A black iron gate stands open beneath hundreds of guttering candles. Beyond it, the road exhales cold mist.",
      biome: "ruined threshold",
      mood: "hushed and watchful",
      dangerLevel: 1
    }
  });

  const ashroot = await prisma.room.upsert({
    where: { slug: "ashroot-path" },
    update: {},
    create: {
      name: "Ashroot Path",
      slug: "ashroot-path",
      description: "Pale roots knot through the ash-gray path. Leaves whisper without wind, repeating half of a forgotten prayer.",
      biome: "quiet forest",
      mood: "mournful",
      dangerLevel: 1
    }
  });

  const well = await prisma.room.upsert({
    where: { slug: "the-quiet-well" },
    update: {},
    create: {
      name: "The Quiet Well",
      slug: "the-quiet-well",
      description: "A round stone well drinks every sound around it. The bucket rope descends into darkness without touching water.",
      biome: "old village",
      mood: "listening",
      dangerLevel: 2
    }
  });

  const shrine = await prisma.room.upsert({
    where: { slug: "old-copper-shrine" },
    update: {},
    create: {
      name: "Old Copper Shrine",
      slug: "old-copper-shrine",
      description: "Copper plates cover a leaning shrine, green with age. Tiny mechanisms tick inside the walls like patient teeth.",
      biome: "forgotten machine shrine",
      mood: "reverent and uneasy",
      dangerLevel: 2
    }
  });

  const exits = [
    [candleGate.id, ashroot.id, "north", "The candle smoke bends toward the Ashroot Path."],
    [ashroot.id, candleGate.id, "south", "The Candle Gate glimmers behind the trees."],
    [ashroot.id, well.id, "east", "A stone-lined footpath leads to the Quiet Well."],
    [well.id, ashroot.id, "west", "The pale roots of Ashroot Path creep back into view."],
    [well.id, shrine.id, "down", "Worn copper steps descend below the well ring."],
    [shrine.id, well.id, "up", "The steps climb toward the silence of the well."]
  ] as const;

  for (const [fromRoomId, toRoomId, direction, description] of exits) {
    await prisma.roomExit.upsert({
      where: { fromRoomId_direction: { fromRoomId, direction } },
      update: {},
      create: { fromRoomId, toRoomId, direction, description }
    });
  }

  const lantern = await prisma.item.create({
    data: {
      name: "Cracked Lantern",
      description: "A smoky lantern with a hairline fracture in its glass. It still remembers light.",
      type: "tool",
      rarity: "common",
      effectJson: { use: "A weak amber glow steadies the room." },
      value: 4
    }
  });

  const coin = await prisma.item.create({
    data: {
      name: "Copper Memory Coin",
      description: "A warm coin stamped with a door no one recalls building.",
      type: "curio",
      rarity: "uncommon",
      effectJson: { lore: "The coin hums near old machines." },
      value: 12
    }
  });

  await prisma.roomItem.upsert({
    where: { roomId_itemId: { roomId: candleGate.id, itemId: lantern.id } },
    update: { quantity: 1 },
    create: { roomId: candleGate.id, itemId: lantern.id, quantity: 1 }
  });
  await prisma.roomItem.upsert({
    where: { roomId_itemId: { roomId: shrine.id, itemId: coin.id } },
    update: { quantity: 1 },
    create: { roomId: shrine.id, itemId: coin.id, quantity: 1 }
  });

  const npc = await prisma.npc.create({
    data: {
      name: "Mara of the Wick",
      description: "An old woman in a soot-dark shawl who tends candles that never quite die.",
      personality: "gentle, cryptic, persistent",
      role: "gate tender",
      memoryJson: { remembers: ["a bell under the well", "the gate opening by itself"] }
    }
  });
  await prisma.roomNpc.upsert({
    where: { roomId_npcId: { roomId: candleGate.id, npcId: npc.id } },
    update: {},
    create: { roomId: candleGate.id, npcId: npc.id }
  });

  const monster = await prisma.monster.create({
    data: {
      name: "Ashroot Skulker",
      description: "A thin bark-skinned thing that moves behind trees one heartbeat late.",
      species: "forest shade",
      level: 1,
      hp: 9,
      attack: 3,
      defense: 1,
      dangerRating: 1,
      lootTableJson: { drops: [{ name: "Splinter Charm", chance: 0.45 }] }
    }
  });
  await prisma.roomMonster.create({
    data: { roomId: ashroot.id, monsterId: monster.id, currentHp: monster.hp }
  });

  await prisma.loreEntry.create({
    data: {
      title: "The Gate That Breathes",
      body: "Locals claim the Candle Gate opens wider on nights when the earth dreams. No one agrees what it inhales.",
      category: "place",
      relatedEntityType: "Room",
      relatedEntityId: candleGate.id
    }
  });

  console.log(`Seeded Breathing World MUD. Admin: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
