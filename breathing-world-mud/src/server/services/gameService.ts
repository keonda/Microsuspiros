import { prisma } from "../db.js";
import { Prisma } from "@prisma/client";
import type { Direction, ParsedCommand } from "../types.js";
import { parseCommand } from "./commandParserService.js";
import { getSettings } from "./settingsService.js";
import {
  generateConnectedRoom,
  generateItem,
  generateLore,
  generateMonster,
  generateNarration,
  generateNpc,
  generateWorldEvent
} from "./worldGeneratorService.js";

const reverseDirection: Record<Direction, Direction> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
  up: "down",
  down: "up"
};

const mapDeltas: Record<string, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
  up: { x: 1, y: -1 },
  down: { x: -1, y: 1 }
};

const helpText = "Commands: look, search, north/south/east/west/up/down, inventory, take [item], drop [item], examine [thing], talk to [npc], attack [monster], use [item], rest.";

type AdventureChoice = {
  label: string;
  command: string;
  tone: "story" | "travel" | "danger" | "rest";
};

type InventoryEntry = {
  quantity: number;
  item: { id?: string; name: string; description?: string };
};

type AdventureRoom = {
  slug: string;
  name: string;
  biome: string;
  mood: string;
  dangerLevel: number;
  exitsFrom: Array<{ direction: string }>;
  items: Array<{ item: { name: string } }>;
  monsters: Array<{ monster: { name: string } }>;
  npcs: Array<{ npc: { name: string } }>;
};

function buildMiniMap(
  rooms: Array<{ id: string; name: string; exitsFrom: Array<{ direction: string; toRoomId: string }> }>,
  currentRoomId?: string | null
) {
  if (!currentRoomId) return { rooms: [], radius: 3 };
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const positions = new Map<string, { id: string; name: string; x: number; y: number; isCurrent: boolean }>();
  const queue = [{ id: currentRoomId, x: 0, y: 0 }];
  const visited = new Set<string>();

  while (queue.length) {
    const next = queue.shift()!;
    if (visited.has(next.id)) continue;
    visited.add(next.id);
    const room = byId.get(next.id);
    if (!room) continue;
    if (Math.abs(next.x) <= 3 && Math.abs(next.y) <= 3) {
      positions.set(room.id, { id: room.id, name: room.name, x: next.x, y: next.y, isCurrent: room.id === currentRoomId });
    }
    for (const exit of room.exitsFrom) {
      const delta = mapDeltas[exit.direction];
      if (!delta || visited.has(exit.toRoomId)) continue;
      const x = next.x + delta.x;
      const y = next.y + delta.y;
      if (Math.abs(x) <= 4 && Math.abs(y) <= 4) queue.push({ id: exit.toRoomId, x, y });
    }
  }

  return { rooms: Array.from(positions.values()), radius: 3 };
}

function combinedInventoryText(inventory: InventoryEntry[]) {
  const grouped = new Map<string, number>();
  for (const entry of inventory) {
    grouped.set(entry.item.name, (grouped.get(entry.item.name) ?? 0) + entry.quantity);
  }
  return Array.from(grouped.entries()).map(([name, quantity]) => `${name} x${quantity}`);
}

function hasInventory(inventory: InventoryEntry[], name: string) {
  const needle = name.toLowerCase();
  return inventory.some((entry) => entry.item.name.toLowerCase().includes(needle));
}

function knownDirections(room: { exitsFrom: Array<{ direction: string }> }) {
  return new Set(room.exitsFrom.map((exit) => exit.direction));
}

async function getAdventureThread(input: {
  characterId: string;
  room: AdventureRoom;
  inventory: InventoryEntry[];
}) {
  const { characterId, room, inventory } = input;
  const coin = hasInventory(inventory, "copper memory coin");
  const gateAnswered = await prisma.loreEntry.findFirst({
    where: { relatedEntityType: "PlayerCharacter", relatedEntityId: characterId, title: "The Candle Gate Answers" }
  });
  const exits = knownDirections(room);
  const unknownDirections = (Object.keys(reverseDirection) as Direction[]).filter((direction) => !exits.has(direction));

  let objective = gateAnswered
    ? "Follow the gate's new whisper and map what lies beyond the old roads."
    : coin
      ? "Return to the Candle Gate and use the Copper Memory Coin."
      : "Find the Copper Memory Coin rumored to rest below the Quiet Well.";

  const choices: AdventureChoice[] = [];

  if (room.slug === "the-candle-gate") {
    objective = gateAnswered ? objective : coin ? "Use the Copper Memory Coin at the Candle Gate." : "Ask Mara what the gate remembers, then seek the old shrine below the well.";
    choices.push({ label: "Speak with Mara about the gate", command: "talk to Mara", tone: "story" });
    if (coin && !gateAnswered) choices.push({ label: "Press the Copper Memory Coin to the gate", command: "use Copper Memory Coin", tone: "story" });
    choices.push({ label: "Take the Ashroot Path", command: "north", tone: "travel" });
  } else if (room.slug === "ashroot-path") {
    choices.push({ label: "Follow the stone path toward the well", command: "east", tone: "travel" });
    choices.push({ label: "Search the ash roots for signs", command: "search", tone: "story" });
    if (room.monsters.length) choices.push({ label: `Face ${room.monsters[0].monster.name}`, command: `attack ${room.monsters[0].monster.name}`, tone: "danger" });
  } else if (room.slug === "the-quiet-well") {
    choices.push({ label: "Descend toward the copper ticking", command: "down", tone: "travel" });
    choices.push({ label: "Listen into the silent well", command: "search", tone: "story" });
    choices.push({ label: "Return to Ashroot Path", command: "west", tone: "travel" });
  } else if (room.slug === "old-copper-shrine") {
    if (!coin) choices.push({ label: "Take the Copper Memory Coin", command: "take Copper Memory Coin", tone: "story" });
    choices.push({ label: "Study the copper mechanisms", command: "search", tone: "story" });
    choices.push({ label: "Climb back to the Quiet Well", command: "up", tone: "travel" });
  }

  for (const entry of room.items.slice(0, 2)) {
    choices.push({ label: `Take ${entry.item.name}`, command: `take ${entry.item.name}`, tone: "story" });
  }
  for (const entry of room.npcs.slice(0, 1)) {
    choices.push({ label: `Talk to ${entry.npc.name}`, command: `talk to ${entry.npc.name}`, tone: "story" });
  }
  for (const entry of room.monsters.slice(0, 1)) {
    choices.push({ label: `Attack ${entry.monster.name}`, command: `attack ${entry.monster.name}`, tone: "danger" });
  }
  for (const direction of unknownDirections.slice(0, 2)) {
    choices.push({ label: `Push into the unmapped ${direction}`, command: direction, tone: "travel" });
  }
  choices.push({ label: "Rest and gather yourself", command: "rest", tone: "rest" });

  const deduped = Array.from(new Map(choices.map((choice) => [choice.command, choice])).values()).slice(0, 5);
  return { objective, choices: deduped };
}

export async function getOrCreateCharacter(userId: string) {
  const existing = await prisma.playerCharacter.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  const start = await prisma.room.findUnique({ where: { slug: "the-candle-gate" } });
  if (!start) throw new Error("Seed room missing. Run prisma seed.");
  return prisma.playerCharacter.create({
    data: { userId, name: "Wayfarer", currentRoomId: start.id }
  });
}

export async function createCharacter(userId: string, name: string) {
  const start = await prisma.room.findUnique({ where: { slug: "the-candle-gate" } });
  if (!start) throw new Error("Seed room missing. Run prisma seed.");
  return prisma.playerCharacter.create({
    data: { userId, name: name.trim().slice(0, 50) || "Wayfarer", currentRoomId: start.id }
  });
}

export async function getGameState(userId: string) {
  const character = await getOrCreateCharacter(userId);
  const room = character.currentRoomId
    ? await prisma.room.findUnique({
        where: { id: character.currentRoomId },
        include: {
          exitsFrom: { include: { toRoom: true }, orderBy: { direction: "asc" } },
          items: { include: { item: true } },
          monsters: { where: { status: "alive" }, include: { monster: true } },
          npcs: { include: { npc: true } },
          events: { orderBy: { createdAt: "desc" }, take: 5 }
        }
      })
    : null;

  const inventory = await prisma.inventoryItem.findMany({
    where: { characterId: character.id },
    include: { item: true },
    orderBy: { item: { name: "asc" } }
  });

  const mapRooms = character.currentRoomId
    ? await prisma.room.findMany({
        select: {
          id: true,
          name: true,
          exitsFrom: { select: { direction: true, toRoomId: true } }
        },
        take: 500
      })
    : [];

  const adventure = room ? await getAdventureThread({ characterId: character.id, room, inventory }) : null;

  return { character, room, inventory, minimap: buildMiniMap(mapRooms, character.currentRoomId), adventure };
}

function findByName<T extends { name: string }>(items: T[], target: string) {
  const lowered = target.toLowerCase();
  return items.find((item) => item.name.toLowerCase() === lowered) ?? items.find((item) => item.name.toLowerCase().includes(lowered));
}

function npcMemoryText(memoryJson: unknown) {
  if (!memoryJson || typeof memoryJson !== "object") return "a road that was not there yesterday";
  const memory = memoryJson as Record<string, unknown>;
  const entries = Array.isArray(memory.memories) ? memory.memories : Array.isArray(memory.remembers) ? memory.remembers : [];
  const first = entries.find((entry) => typeof entry === "string");
  return first || "a road that was not there yesterday";
}

function localNpcDialogue(npc: { name: string; personality: string; role: string; memoryJson: unknown }, roomName: string) {
  const memory = npcMemoryText(npc.memoryJson);
  const role = npc.role.toLowerCase();
  if (role.includes("tender") || role.includes("keeper")) {
    return `"Keep your voice low," ${npc.name} says. "This place wakes when names are spoken. I still remember ${memory}."`;
  }
  if (role.includes("wander") || role.includes("pilgrim")) {
    return `"I passed through ${roomName} before the dust settled," ${npc.name} murmurs. "Ask the walls about ${memory}."`;
  }
  if (npc.personality.toLowerCase().includes("wary")) {
    return `${npc.name} studies you for a long moment. "I know only this: ${memory}. Do not spend it carelessly."`;
  }
  return `${npc.name} leans closer. "I remember ${memory}. That memory may matter before the next door opens."`;
}

async function maybeTick(characterId: string, roomId: string) {
  const character = await prisma.playerCharacter.update({
    where: { id: characterId },
    data: { commandCount: { increment: 1 } }
  });
  if (character.commandCount % 6 !== 5) return null;

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return null;

  const settings = await getSettings();
  const event = settings.worldGenerationEnabled
    ? await generateWorldEvent(room.name)
    : {
        title: "A Small Unease",
        description: "The room seems to hold its breath for a moment, then settles.",
        eventType: "ambient",
        metadataJson: { fallback: true }
      };

  const saved = await prisma.worldEvent.create({
    data: { ...event, metadataJson: event.metadataJson as Prisma.InputJsonValue, roomId }
  });

  if (settings.worldGenerationEnabled && Math.random() < 0.35) {
    const lore = await generateLore(`${room.name}: ${saved.description}`);
    await prisma.loreEntry.create({ data: { ...lore, relatedEntityType: "Room", relatedEntityId: room.id } });
  }

  return saved.description;
}

async function createModestRoom(currentRoomId: string, direction: Direction) {
  const current = await prisma.room.findUnique({ where: { id: currentRoomId } });
  if (!current) throw new Error("Current room missing");

  const generated = await generateConnectedRoom({
    fromRoomName: current.name,
    fromRoomDescription: current.description,
    direction,
    seed: current.id
  });

  const room = await prisma.room.create({
    data: {
      name: generated.name,
      slug: generated.slug,
      description: generated.description,
      biome: generated.biome,
      mood: generated.mood,
      dangerLevel: generated.dangerLevel,
      isGenerated: true
    }
  });

  await prisma.roomExit.create({
    data: { fromRoomId: current.id, toRoomId: room.id, direction, description: generated.exitDescription }
  });
  await prisma.roomExit.create({
    data: {
      fromRoomId: room.id,
      toRoomId: current.id,
      direction: reverseDirection[direction],
      description: "The way back remains visible, though the air around it shivers."
    }
  });

  const sideDirections = (Object.keys(reverseDirection) as Direction[]).filter(
    (candidate) => candidate !== reverseDirection[direction]
  );
  const sideExitCount = Math.random() < 0.65 ? 1 : 2;
  for (const sideDirection of sideDirections.sort(() => Math.random() - 0.5).slice(0, sideExitCount)) {
    await prisma.worldEvent.create({
      data: {
        roomId: room.id,
        title: `A possible way ${sideDirection}`,
        description: `The air ${sideDirection} of here looks unsettled, as if a path could be pressed into it.`,
        eventType: "frontier",
        metadataJson: { direction: sideDirection } as Prisma.InputJsonValue
      }
    });
  }

  const settings = await getSettings();
  if (settings.worldGenerationEnabled) {
    if (Math.random() < 0.55) {
      const itemData = await generateItem(room.name);
      const item = await prisma.item.create({ data: { ...itemData, effectJson: itemData.effectJson as Prisma.InputJsonValue, isGenerated: true } });
      await prisma.roomItem.create({ data: { roomId: room.id, itemId: item.id, quantity: 1 } });
    }
    if (Math.random() < 0.45) {
      const monsterData = await generateMonster(room.name);
      const monster = await prisma.monster.create({ data: { ...monsterData, lootTableJson: monsterData.lootTableJson as Prisma.InputJsonValue, isGenerated: true } });
      await prisma.roomMonster.create({ data: { roomId: room.id, monsterId: monster.id, currentHp: monster.hp } });
    }
    if (Math.random() < 0.25) {
      const npcData = await generateNpc(room.name);
      const npc = await prisma.npc.create({ data: { ...npcData, memoryJson: npcData.memoryJson as Prisma.InputJsonValue, isGenerated: true } });
      await prisma.roomNpc.create({ data: { roomId: room.id, npcId: npc.id } });
    }
  }

  return room;
}

async function resolveCommand(userId: string, parsed: ParsedCommand) {
  const state = await getGameState(userId);
  const { character, room } = state;
  if (!room) return { lines: ["You are nowhere. The world has misplaced you."], tick: null };

  switch (parsed.action) {
    case "help":
      return { lines: [helpText], tick: null };
    case "look":
      return { lines: [room.description], tick: await maybeTick(character.id, room.id) };
    case "search": {
      const clues = [
        `You slow down and search ${room.name}.`,
        room.events[0]?.description ?? `The strongest clue is the room itself: ${room.mood}, ${room.biome}, danger ${room.dangerLevel}.`
      ];
      if (room.slug === "the-quiet-well") clues.push("Far below, something copper ticks three times and waits.");
      if (room.slug === "old-copper-shrine") clues.push("The shrine's plates are arranged like a question waiting for a coin-shaped answer.");
      if (room.slug === "ashroot-path") clues.push("The roots lean east, toward stone and silence.");
      return { lines: clues, tick: await maybeTick(character.id, room.id) };
    }
    case "inventory":
      const inventoryLines = combinedInventoryText(state.inventory);
      return {
        lines: inventoryLines.length
          ? [`You carry: ${inventoryLines.join(", ")}.`]
          : ["Your pack is empty."],
        tick: null
      };
    case "go": {
      const exit = room.exitsFrom.find((candidate) => candidate.direction === parsed.direction);
      if (exit?.isLocked) return { lines: [`The way ${parsed.direction} is locked.`], tick: null };
      let destinationId = exit?.toRoomId;
      let generated = false;
      if (!destinationId) {
        const settings = await getSettings();
        if (!settings.worldGenerationEnabled) {
          return { lines: [`There is no path ${parsed.direction}. World generation is disabled in admin settings.`], tick: await maybeTick(character.id, room.id) };
        }
        const created = await createModestRoom(room.id, parsed.direction);
        destinationId = created.id;
        generated = true;
      }
      await prisma.playerCharacter.update({ where: { id: character.id }, data: { currentRoomId: destinationId } });
      const destination = await prisma.room.findUnique({ where: { id: destinationId } });
      return {
        lines: [
          generated ? `You press ${parsed.direction} into unmapped dark.` : `You go ${parsed.direction}.`,
          generated && destination ? `New room discovered: ${destination.name}.` : "",
          destination?.description ?? "The path opens into darkness."
        ].filter(Boolean),
        tick: generated ? "world breathes..." : await maybeTick(character.id, destinationId)
      };
    }
    case "take": {
      const roomItem = room.items.find((entry) => findByName([entry.item], parsed.target));
      if (!roomItem) return { lines: [`You do not see ${parsed.target} here.`], tick: null };
      await prisma.inventoryItem.upsert({
        where: { characterId_itemId: { characterId: character.id, itemId: roomItem.itemId } },
        update: { quantity: { increment: 1 } },
        create: { characterId: character.id, itemId: roomItem.itemId, quantity: 1 }
      });
      if (roomItem.quantity <= 1) {
        await prisma.roomItem.delete({ where: { id: roomItem.id } });
      } else {
        await prisma.roomItem.update({ where: { id: roomItem.id }, data: { quantity: { decrement: 1 } } });
      }
      return { lines: [`You take ${roomItem.item.name}.`], tick: await maybeTick(character.id, room.id) };
    }
    case "drop": {
      const inventoryItem = state.inventory.find((entry) => findByName([entry.item], parsed.target));
      if (!inventoryItem) return { lines: [`You are not carrying ${parsed.target}.`], tick: null };
      await prisma.roomItem.upsert({
        where: { roomId_itemId: { roomId: room.id, itemId: inventoryItem.itemId } },
        update: { quantity: { increment: 1 } },
        create: { roomId: room.id, itemId: inventoryItem.itemId, quantity: 1 }
      });
      if (inventoryItem.quantity <= 1) {
        await prisma.inventoryItem.delete({ where: { id: inventoryItem.id } });
      } else {
        await prisma.inventoryItem.update({ where: { id: inventoryItem.id }, data: { quantity: { decrement: 1 } } });
      }
      return { lines: [`You drop ${inventoryItem.item.name}.`], tick: await maybeTick(character.id, room.id) };
    }
    case "examine": {
      const item = findByName(room.items.map((entry) => entry.item), parsed.target) ?? findByName(state.inventory.map((entry) => entry.item), parsed.target);
      const npc = findByName(room.npcs.map((entry) => entry.npc), parsed.target);
      const monster = findByName(room.monsters.map((entry) => entry.monster), parsed.target);
      const exit = room.exitsFrom.find((entry) => entry.direction === parsed.target);
      const text = item?.description ?? npc?.description ?? monster?.description ?? exit?.description ?? (room.name.toLowerCase().includes(parsed.target.toLowerCase()) ? room.description : null);
      return { lines: [text ?? `You find nothing special about ${parsed.target}.`], tick: null };
    }
    case "talk": {
      const npc = findByName(room.npcs.map((entry) => entry.npc), parsed.target);
      if (!npc) return { lines: [`No one named ${parsed.target} answers.`], tick: null };
      const settings = await getSettings();
      const fallbackLine = localNpcDialogue(npc, room.name);
      const aiLine = settings.worldGenerationEnabled
        ? await generateNarration(
            "encounter",
            `Write one in-character NPC dialogue line. NPC: ${npc.name}. Description: ${npc.description}. Personality: ${npc.personality}. Role: ${npc.role}. Room: ${room.name}. Known memory: ${npcMemoryText(npc.memoryJson)}.`
          )
        : "";
      await prisma.npc.update({
        where: { id: npc.id },
        data: {
          memoryJson: {
            ...((npc.memoryJson && typeof npc.memoryJson === "object" && !Array.isArray(npc.memoryJson) ? npc.memoryJson : {}) as Record<string, unknown>),
            lastSpokenRoom: room.name,
            lastSpokenAt: new Date().toISOString()
          } as Prisma.InputJsonValue
        }
      });
      const line = aiLine && aiLine !== "The moment lands with a short, sharp echo." ? aiLine : fallbackLine;
      return { lines: [`${npc.name} turns toward you.`, line], tick: await maybeTick(character.id, room.id) };
    }
    case "use": {
      const inventoryItem = state.inventory.find((entry) => findByName([entry.item], parsed.target));
      if (!inventoryItem) return { lines: [`You are not carrying ${parsed.target}.`], tick: null };
      if (room.slug === "the-candle-gate" && inventoryItem.item.name.toLowerCase().includes("copper memory coin")) {
        const existing = await prisma.loreEntry.findFirst({
          where: { relatedEntityType: "PlayerCharacter", relatedEntityId: character.id, title: "The Candle Gate Answers" }
        });
        if (!existing) {
          await prisma.loreEntry.create({
            data: {
              title: "The Candle Gate Answers",
              body: "The Copper Memory Coin warmed against the Candle Gate. Somewhere beyond the mapped roads, a bell answered from under the earth.",
              category: "quest",
              relatedEntityType: "PlayerCharacter",
              relatedEntityId: character.id
            }
          });
          await prisma.playerCharacter.update({
            where: { id: character.id },
            data: { level: { increment: 1 }, maxHp: { increment: 4 }, hp: { increment: 4 } }
          });
          return {
            lines: [
              "You press the Copper Memory Coin against the Candle Gate.",
              "The gate inhales. Every candle bends inward. A low bell answers from somewhere no map admits.",
              "Milestone reached: The Candle Gate remembers you. You feel sturdier."
            ],
            tick: "world breathes..."
          };
        }
        return { lines: ["The Candle Gate is already awake to the coin. Its candles lean toward unmapped roads."], tick: null };
      }
      return { lines: [`You use ${inventoryItem.item.name}. ${inventoryItem.item.description}`], tick: await maybeTick(character.id, room.id) };
    }
    case "rest": {
      const healed = Math.min(character.maxHp, character.hp + 6);
      await prisma.playerCharacter.update({ where: { id: character.id }, data: { hp: healed } });
      return { lines: [`You rest and recover to ${healed}/${character.maxHp} HP.`], tick: await maybeTick(character.id, room.id) };
    }
    case "attack": {
      const target = room.monsters.find((entry) => findByName([entry.monster], parsed.target));
      if (!target) return { lines: [`There is no ${parsed.target} here to attack.`], tick: null };
      const playerDamage = Math.max(1, character.attack + Math.floor(Math.random() * 4) - target.monster.defense);
      const monsterHp = target.currentHp - playerDamage;
      const lines = [`You strike ${target.monster.name} for ${playerDamage} damage.`];
      if (monsterHp <= 0) {
        await prisma.roomMonster.update({ where: { id: target.id }, data: { currentHp: 0, status: "defeated" } });
        lines.push(`${target.monster.name} falls.`);
        const loot = await prisma.item.create({
          data: {
            name: `${target.monster.name} Remnant`,
            description: `A strange remnant left by ${target.monster.name}.`,
            type: "loot",
            rarity: "common",
            effectJson: {},
            value: Math.max(1, target.monster.level * 3),
            isGenerated: true
          }
        });
        await prisma.roomItem.create({ data: { roomId: room.id, itemId: loot.id, quantity: 1 } });
        lines.push(`${loot.name} drops to the floor.`);
      } else {
        await prisma.roomMonster.update({ where: { id: target.id }, data: { currentHp: monsterHp } });
        const monsterDamage = Math.max(1, target.monster.attack + Math.floor(Math.random() * 3) - character.defense);
        const playerHp = Math.max(0, character.hp - monsterDamage);
        await prisma.playerCharacter.update({ where: { id: character.id }, data: { hp: playerHp } });
        lines.push(`${target.monster.name} hits back for ${monsterDamage} damage.`);
        if (playerHp <= 0) {
          await prisma.playerCharacter.update({ where: { id: character.id }, data: { hp: Math.ceil(character.maxHp / 2) } });
          lines.push("You collapse, dream of a candlelit threshold, and wake battered but alive.");
        }
      }
      const settings = await getSettings();
      if (settings.worldGenerationEnabled) {
        lines.push(await generateNarration("combat", lines.join(" ")));
      }
      return { lines, tick: await maybeTick(character.id, room.id) };
    }
    default:
      return { lines: [`I do not understand "${parsed.raw}". ${helpText}`], tick: null };
  }
}

export async function runPlayerCommand(userId: string, input: string) {
  const parsed = parseCommand(input);
  const result = await resolveCommand(userId, parsed);
  return { parsed, ...result, state: await getGameState(userId) };
}
