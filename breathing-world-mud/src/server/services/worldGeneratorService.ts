import { z } from "zod";
import { prisma } from "../db.js";
import { getGroqApiKey, getSettings } from "./settingsService.js";

const roomSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(10).max(700),
  biome: z.string().min(2).max(80),
  mood: z.string().min(2).max(80),
  dangerLevel: z.number().int().min(1).max(5),
  exitDescription: z.string().min(4).max(220)
});

const monsterSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(10).max(500),
  species: z.string().min(2).max(80),
  level: z.number().int().min(1).max(10),
  hp: z.number().int().min(3).max(80),
  attack: z.number().int().min(1).max(20),
  defense: z.number().int().min(0).max(20),
  dangerRating: z.number().int().min(1).max(5),
  lootTableJson: z.record(z.string(), z.unknown()).default({ drops: [] })
});

const itemSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(8).max(400),
  type: z.string().min(2).max(40),
  rarity: z.string().min(2).max(40),
  effectJson: z.record(z.string(), z.unknown()).default({}),
  value: z.number().int().min(0).max(1000)
});

const npcSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(10).max(500),
  personality: z.string().min(2).max(120),
  role: z.string().min(2).max(80),
  memoryJson: z.record(z.string(), z.unknown()).default({ memories: [] })
});

const loreSchema = z.object({
  title: z.string().min(2).max(100),
  body: z.string().min(10).max(700),
  category: z.string().min(2).max(60)
});

const eventSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().min(10).max(400),
  eventType: z.string().min(2).max(60),
  metadataJson: z.record(z.string(), z.unknown()).default({})
});

const textSchema = z.object({
  text: z.string().min(4).max(500)
});

type SchemaMap = {
  room: z.infer<typeof roomSchema>;
  monster: z.infer<typeof monsterSchema>;
  item: z.infer<typeof itemSchema>;
  npc: z.infer<typeof npcSchema>;
  lore: z.infer<typeof loreSchema>;
  event: z.infer<typeof eventSchema>;
  text: z.infer<typeof textSchema>;
};

const schemas = {
  room: roomSchema,
  monster: monsterSchema,
  item: itemSchema,
  npc: npcSchema,
  lore: loreSchema,
  event: eventSchema,
  text: textSchema
};

const fallback: SchemaMap = {
  room: {
    name: "A Narrow Forgotten Room",
    description: "A cramped chamber of old stone waits beyond the dark, its dust disturbed by recent footsteps.",
    biome: "old ruin",
    mood: "quietly tense",
    dangerLevel: 1,
    exitDescription: "A thin passage joins this room to the known path."
  },
  monster: {
    name: "Pale Lurker",
    description: "A cautious thing with lamp-like eyes watches from the edge of the room.",
    species: "liminal stray",
    level: 1,
    hp: 8,
    attack: 3,
    defense: 1,
    dangerRating: 1,
    lootTableJson: { drops: [] }
  },
  item: {
    name: "Bent Iron Token",
    description: "A small iron token, bent around a mark that looks almost like a door.",
    type: "curio",
    rarity: "common",
    effectJson: { use: "It feels cold, then ordinary." },
    value: 2
  },
  npc: {
    name: "The Quiet Pilgrim",
    description: "A travel-worn stranger sits very still, listening to things behind the walls.",
    personality: "soft-spoken and wary",
    role: "wanderer",
    memoryJson: { memories: ["a road that was not there yesterday"] }
  },
  lore: {
    title: "A Name Under Dust",
    body: "Someone has scratched the same name into several stones, but each carving ends before the last letter.",
    category: "rumor"
  },
  event: {
    title: "A Distant Dragging Sound",
    description: "You hear something dragging metal far below, then the sound stops as if it heard you listening.",
    eventType: "ambient",
    metadataJson: { intensity: "minor" }
  },
  text: {
    text: "The moment lands with a short, sharp echo."
  }
};

function systemPrompt(safetyEnabled: boolean) {
  return [
    "Return valid JSON only. No markdown, no prose outside JSON.",
    "Keep descriptions concise and database-friendly.",
    "Do not use copyrighted settings, characters, or proper nouns.",
    "Tone: strange liminal dark fantasy with ruins, quiet forests, forgotten machines, candlelit towns, underground rivers, abandoned towers.",
    "Avoid expanding the world too quickly; make generated entities reusable and gameplay-purposeful.",
    safetyEnabled ? "Avoid graphic sexual content, hateful content, and extreme gore." : "Keep content appropriate for a fantasy adventure game."
  ].join("\n");
}

function extractJson(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? trimmed;
}

async function groqJson<T extends keyof SchemaMap>(type: T, prompt: string): Promise<SchemaMap[T]> {
  const settings = await getSettings();
  const apiKey = await getGroqApiKey();
  const schema = schemas[type];

  if (!apiKey) return fallback[type];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let body = "";
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: settings.groqModelName,
          temperature: settings.aiCreativity,
          max_tokens: settings.maxTokens,
          messages: [
            { role: "system", content: systemPrompt(settings.safetyEnabled) },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      body = await response.text();
      if (!response.ok) {
        await prisma.aiGenerationLog.create({ data: { type, prompt, response: body } });
        continue;
      }
    } catch (error) {
      await prisma.aiGenerationLog.create({
        data: { type, prompt, response: `Groq request failed: ${error instanceof Error ? error.message : "unknown error"}` }
      });
      continue;
    }

    try {
      const payload = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content ?? "";
      const parsed = schema.parse(JSON.parse(extractJson(content))) as SchemaMap[T];
      await prisma.aiGenerationLog.create({ data: { type, prompt, response: content } });
      return parsed;
    } catch (error) {
      await prisma.aiGenerationLog.create({
        data: { type, prompt, response: `Invalid JSON attempt ${attempt + 1}: ${body.slice(0, 4000)}` }
      });
    }
  }

  return fallback[type];
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "generated-room";
  let candidate = base;
  let suffix = 2;
  while (await prisma.room.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function generateConnectedRoom(input: {
  fromRoomName: string;
  fromRoomDescription: string;
  direction: string;
}) {
  const data = await groqJson(
    "room",
    `Generate one new connected room as JSON with keys name, description, biome, mood, dangerLevel, exitDescription. Existing room: ${input.fromRoomName}. Description: ${input.fromRoomDescription}. Direction: ${input.direction}.`
  );
  return {
    ...data,
    slug: await uniqueSlug(data.name)
  };
}

export async function generateMonster(roomName: string) {
  return groqJson("monster", `Generate one modest monster for room "${roomName}" as JSON.`);
}

export async function generateItem(roomName: string) {
  return groqJson("item", `Generate one useful or curious item for room "${roomName}" as JSON.`);
}

export async function generateNpc(roomName: string) {
  return groqJson("npc", `Generate one NPC for room "${roomName}" as JSON.`);
}

export async function generateLore(context: string) {
  return groqJson("lore", `Generate one rumor or lore entry as JSON. Context: ${context}`);
}

export async function generateWorldEvent(roomName: string) {
  return groqJson("event", `Generate one minor ambient room event for "${roomName}" as JSON.`);
}

export async function generateNarration(kind: "encounter" | "combat", context: string) {
  const data = await groqJson("text", `Generate short ${kind} narration as JSON with key text. Context: ${context}`);
  return data.text;
}
