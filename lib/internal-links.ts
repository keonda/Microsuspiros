import type { LinkableType, PrismaClient } from "@prisma/client";

export type LinkSource = {
  projectId: string;
  sourceType: LinkableType;
  sourceId: string;
  text: string;
};

type Candidate = {
  type: LinkableType;
  id: string;
  title: string;
  href: string;
};

const wikiLinkPattern = /\[\[([^\]]{1,180})\]\]/g;

export function extractWikiLinks(text: string) {
  const links: { rawText: string; normalizedText: string; excerpt: string }[] = [];
  for (const match of text.matchAll(wikiLinkPattern)) {
    const rawText = match[1]?.trim();
    if (!rawText) continue;
    links.push({
      rawText,
      normalizedText: normalizeLinkText(rawText),
      excerpt: excerptAround(text, match.index ?? 0, rawText.length + 4)
    });
  }
  return dedupeLinks(links);
}

export function normalizeLinkText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/^(character|location|research|note|chapter|resource|card)\s*:\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function syncInternalLinks(prisma: PrismaClient, source: LinkSource) {
  const extracted = extractWikiLinks(source.text);
  await prisma.internalLink.deleteMany({
    where: { projectId: source.projectId, sourceType: source.sourceType, sourceId: source.sourceId }
  });

  if (!extracted.length) return;

  const candidates = await linkCandidates(prisma, source.projectId);
  await prisma.internalLink.createMany({
    data: extracted.map((link) => {
      const target = candidates.find((candidate) => normalizeLinkText(candidate.title) === link.normalizedText);
      return {
        projectId: source.projectId,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        targetType: target?.type,
        targetId: target?.id,
        rawText: link.rawText,
        normalizedText: link.normalizedText,
        excerpt: link.excerpt
      };
    })
  });
}

export async function linkCandidates(prisma: PrismaClient, projectId: string): Promise<Candidate[]> {
  const [documents, storyNotes, researchNotes, cards, resources] = await Promise.all([
    prisma.document.findMany({ where: { projectId, isTrash: false }, select: { id: true, title: true, projectId: true } }),
    prisma.storyNote.findMany({ where: { projectId }, select: { id: true, title: true, projectId: true } }),
    prisma.researchNote.findMany({ where: { projectId }, select: { id: true, title: true, projectId: true } }),
    prisma.brainstormCard.findMany({ where: { projectId }, select: { id: true, title: true, projectId: true } }),
    prisma.resource.findMany({ where: { projectId }, select: { id: true, title: true, projectId: true } })
  ]);

  return [
    ...documents.map((item) => ({ type: "DOCUMENT" as const, id: item.id, title: item.title, href: `/projects/${item.projectId}/documents/${item.id}` })),
    ...storyNotes.map((item) => ({ type: "STORY_NOTE" as const, id: item.id, title: item.title, href: `/projects/${item.projectId}/notes#${item.id}` })),
    ...researchNotes.map((item) => ({ type: "RESEARCH_NOTE" as const, id: item.id, title: item.title, href: `/projects/${item.projectId}/research#${item.id}` })),
    ...cards.map((item) => ({ type: "BRAINSTORM_CARD" as const, id: item.id, title: item.title, href: `/projects/${item.projectId}/brainstorm#${item.id}` })),
    ...resources.map((item) => ({ type: "RESOURCE" as const, id: item.id, title: item.title, href: `/projects/${item.projectId}/resources#${item.id}` }))
  ];
}

function excerptAround(text: string, index: number, length: number) {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + length + 80);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function dedupeLinks(links: { rawText: string; normalizedText: string; excerpt: string }[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.rawText}:${link.normalizedText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
