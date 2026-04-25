import type { LinkableType, PrismaClient, StoryEntityType } from "@prisma/client";

const stopNames = new Set([
  "The",
  "A",
  "An",
  "And",
  "But",
  "When",
  "Then",
  "Chapter",
  "Scene",
  "Part",
  "Act",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
]);

type MentionSource = {
  projectId: string;
  userId: string;
  sourceType: LinkableType;
  sourceId: string;
  text: string;
};

export function detectEntityCandidates(text: string) {
  const counts = new Map<string, { name: string; count: number; positions: number[]; excerpts: string[] }>();
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
  for (const match of text.matchAll(pattern)) {
    const name = match[1]?.trim();
    const position = match.index ?? 0;
    if (!name || stopNames.has(name) || name.length < 3 || name.length > 80) continue;
    if (/^(Chapter|Scene|Part|Act)\s/i.test(name)) continue;
    const existing = counts.get(name) || { name, count: 0, positions: [], excerpts: [] };
    existing.count += 1;
    existing.positions.push(position);
    if (existing.excerpts.length < 3) existing.excerpts.push(excerptAround(text, position, name.length));
    counts.set(name, existing);
  }
  return [...counts.values()]
    .filter((candidate) => candidate.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 40);
}

export async function syncEntityMentions(prisma: PrismaClient, source: MentionSource) {
  const entities = await prisma.storyEntity.findMany({
    where: { projectId: source.projectId, userId: source.userId },
    select: { id: true, name: true, aliases: true }
  });
  await prisma.entityMention.deleteMany({
    where: { projectId: source.projectId, sourceType: source.sourceType, sourceId: source.sourceId }
  });
  const mentions: { projectId: string; userId: string; entityId: string; sourceType: LinkableType; sourceId: string; excerpt: string; position: number }[] = [];
  for (const entity of entities) {
    const names = [entity.name, ...entity.aliases].filter(Boolean);
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      for (const match of source.text.matchAll(regex)) {
        const position = match.index ?? 0;
        mentions.push({
          projectId: source.projectId,
          userId: source.userId,
          entityId: entity.id,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          excerpt: excerptAround(source.text, position, name.length),
          position
        });
      }
    }
  }
  if (mentions.length) await prisma.entityMention.createMany({ data: mentions.slice(0, 500) });
}

export function normalizeEntityType(input: string | null | undefined): StoryEntityType {
  const value = String(input || "UNKNOWN").toUpperCase();
  if (["CHARACTER", "LOCATION", "OBJECT", "ORGANIZATION", "CONCEPT", "UNKNOWN"].includes(value)) return value as StoryEntityType;
  return "UNKNOWN";
}

function excerptAround(text: string, index: number, length: number) {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + length + 90);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}
