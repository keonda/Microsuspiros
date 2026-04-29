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

const helpText = "Commands: look, north/south/east/west/up/down, inventory, take [item], drop [item], examine [thing], talk to [npc], attack [monster], use [item], rest.";

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

  return { character, room, inventory };
}

function findByName<T extends { name: string }>(items: T[], target: string) {
  const lowered = target.toLowerCase();
  return items.find((item) => item.name.toLowerCase() === lowered) ?? items.find((item) => item.name.toLowerCase().includes(lowered));
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
    direction
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
    case "inventory":
      return {
        lines: state.inventory.length
          ? [`You carry: ${state.inventory.map((entry) => `${entry.item.name} x${entry.quantity}`).join(", ")}.`]
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
          return { lines: [`There is no path ${parsed.direction}.`], tick: await maybeTick(character.id, room.id) };
        }
        const created = await createModestRoom(room.id, parsed.direction);
        destinationId = created.id;
        generated = true;
      }
      await prisma.playerCharacter.update({ where: { id: character.id }, data: { currentRoomId: destinationId } });
      const destination = await prisma.room.findUnique({ where: { id: destinationId } });
      return {
        lines: [`You go ${parsed.direction}.`, destination?.description ?? "The path opens into darkness."],
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
      const text = item?.description ?? npc?.description ?? monster?.description ?? exit?.description;
      return { lines: [text ?? `You find nothing special about ${parsed.target}.`], tick: null };
    }
    case "talk": {
      const npc = findByName(room.npcs.map((entry) => entry.npc), parsed.target);
      if (!npc) return { lines: [`No one named ${parsed.target} answers.`], tick: null };
      const settings = await getSettings();
      const line = settings.worldGenerationEnabled
        ? await generateNarration("encounter", `NPC ${npc.name}, personality ${npc.personality}, role ${npc.role}, room ${room.name}`)
        : `${npc.name} says, "Listen carefully. This place remembers footsteps."`;
      return { lines: [`${npc.name}: ${line}`], tick: await maybeTick(character.id, room.id) };
    }
    case "use": {
      const inventoryItem = state.inventory.find((entry) => findByName([entry.item], parsed.target));
      if (!inventoryItem) return { lines: [`You are not carrying ${parsed.target}.`], tick: null };
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
